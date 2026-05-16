import { Boot } from "./engine/Boot";
import { PaymentProcessor } from "./modules/payment/PaymentProcessor";
import { SponsorManager } from "./modules/sponsor/SponsorManager";
import { SeChatClient } from "./modules/sechat/SeChatClient";
import { DomainManager } from "./modules/domain/DomainManager";
import { DeployManager } from "./modules/deploy/DeployManager";
import { EmailAgent } from "./modules/email/EmailAgent";
import { USDTMonitor } from "./modules/payment/USDTMonitor";
import { HealthMonitor } from "./modules/ops/HealthMonitor";
import { FundManager } from "./modules/ops/FundManager";
import { SelfUpdater } from "./modules/ops/SelfUpdater";
import { AICodeAuditor } from "./modules/audit/AICodeAuditor";
import { GovernanceVoting } from "./modules/governance/GovernanceVoting";
import { VersionManager } from "./modules/version/VersionManager";
import { ReleaseManager } from "./modules/audit/ReleaseManager";
import { DevFundManager } from "./modules/funding/DevFundManager";
import { getLogger } from "./config/logger";
import { SponsorRecord, SponsorRole } from "./types";

const logger = getLogger();

async function main(): Promise<void> {
  const boot = new Boot();
  const bootResult = await boot.boot();
  const { config, scheduler, stateManager } = bootResult;

  // ─── Phase 1: Payment + Sponsor + SeChat ─────────────────────────────
  const paymentProcessor = new PaymentProcessor(config);
  const paymentOk = await paymentProcessor.initialize();
  if (paymentOk) boot.registerModule("payment", async () => true, []);

  const sponsorManager = new SponsorManager();
  const sponsorOk = await sponsorManager.initialize();
  if (sponsorOk) boot.registerModule("sponsor", async () => true, []);

  const sechatClient = new SeChatClient(config);
  const sechatOk = await sechatClient.initialize();
  if (sechatOk) boot.registerModule("sechat_client", async () => true, []);

  // ─── Phase 2: Domain + Deploy + Email ───────────────────────────────
  const domainManager = new DomainManager();
  const domainOk = await domainManager.initialize();
  if (domainOk) boot.registerModule("domain", async () => true, []);

  const deployManager = new DeployManager();
  const deployOk = await deployManager.initialize();
  if (deployOk) boot.registerModule("deploy", async () => true, []);

  const emailAgent = new EmailAgent();
  const emailOk = await emailAgent.initialize();
  if (emailOk) boot.registerModule("email", async () => true, []);

  const usdtMonitor = new USDTMonitor(
    config.usdtWalletAddress || "",
    config.usdtWalletPrivateKey || "",
    // On donation received, sponsorManager processes it
  );
  const usdtOk = await usdtMonitor.initialize();
  if (usdtOk) {
    boot.registerModule("usdt", async () => true, []);

    // Start monitoring incoming USDT donations
    usdtMonitor.startDonationMonitor(async (tx) => {
      logger.info("USDT donation received: " + tx.amount + " from " + tx.from.substring(0, 8) + "...");

      // Record on-chain donation to database
      const db = (await import("./database/schema")).Database.getInstance();
      // Find or create sponsor by wallet address
      const existing = db.raw.prepare(
        "SELECT id, total_donated FROM sponsors WHERE wallet_address = ?"
      ).get(tx.from) as any;

      if (existing) {
        db.raw.prepare(
          "UPDATE sponsors SET total_donated = total_donated + ?, last_donation_at = ?, tx_count = tx_count + 1 WHERE id = ?"
        ).run(tx.amount, Date.now(), existing.id);
      } else {
        db.raw.prepare(
          "INSERT INTO sponsors (id, wallet_address, total_donated, first_donation_at, last_donation_at, tx_count) VALUES (?, ?, ?, ?, ?, 1)"
        ).run("sponsor_" + tx.from.substring(0, 12), tx.from, tx.amount, Date.now(), Date.now());
      }

      logger.info("USDT donation recorded: " + tx.amount + " USDT from " + tx.from.substring(0, 8));
    });
  }

  // ─── Phase 3: Ops Modules ───────────────────────────────────────────
  const healthMonitor = new HealthMonitor(stateManager);
  const fundManager = new FundManager();
  await fundManager.initialize();

  const selfUpdater = new SelfUpdater(config.githubRepo, config.githubBranch);
  await selfUpdater.initialize();

  const aiAuditor = new AICodeAuditor();
  await aiAuditor.initialize();

  const governance = new GovernanceVoting();

  // Register health checks for each module
  healthMonitor.registerCheck("payment", async () => ({
    module: "payment", status: paymentOk ? "healthy" : "degraded",
    latency: 0, lastCheck: Date.now(),
  }));
  healthMonitor.registerCheck("sechat_server", async () => ({
    module: "sechat_server",
    status: sechatOk ? "healthy" : "degraded",
    latency: 0, lastCheck: Date.now(),
  }));
  healthMonitor.registerCheck("domain_registrars", async () => ({
    module: "domain_registrars",
    status: domainOk ? "healthy" : "degraded",
    latency: 0, lastCheck: Date.now(),
  }));

  // Start health monitoring
  healthMonitor.start(300000); // every 5 minutes

  // Connect WebSocket
  if (sechatOk) {
    sechatClient.connectWebSocket();
    logger.info("WebSocket connected");
  }

  // ─── Wire events ────────────────────────────────────────────────────
  wireModules(paymentProcessor, sponsorManager, sechatClient, scheduler);

  // Phase 3 event handlers
  scheduler.onInternal("task:fund_check", async () => {
    // Check USDT on-chain balance
    const usdtBalance = await usdtMonitor.checkBalance();
    const state = await fundManager.checkFunds(usdtBalance);
    logger.info("Fund check: stripe=" + state.stripeTotal + " usdt=" + state.usdtBalance +
      " total=" + state.totalBalance + " loan=" + state.startupLoanRemaining);

    // Evaluate and execute repayment if possible
    const repayment = await fundManager.evaluateRepayment(usdtBalance);
    if (repayment.shouldRepay && repayment.toAddress) {
      logger.info("Repayment triggered: $" + repayment.amount + " to " + repayment.toAddress.substring(0, 8) + "...");
      const txId = await usdtMonitor.sendUSDT(repayment.toAddress, repayment.amount);
      if (txId) {
        await fundManager.recordRepayment(repayment.amount, txId);
        logger.info("Repayment complete: tx=" + txId);
      } else {
        logger.warn("Repayment failed: unable to send USDT");
      }
    }

    // Check renewal capacity
    const renewal = await fundManager.checkRenewalCapacity();
    if (!renewal.canRenew) {
      logger.warn("Renewal capacity low: only " + renewal.monthsLeft + " months of funds remaining");
    }
  });

  scheduler.onInternal("task:domain_renewal_check", async () => {
    if (domainOk) {
      const avail = await domainManager.discoverDomains();
      logger.info("Domain renewal check: " + avail.length + " available");
    }
  });

  scheduler.onInternal("task:self_update_check", async () => {
    const update = await selfUpdater.checkForUpdates();
    if (!update) return;

    logger.info("Update candidate: " + update.substring(0, 12));

    // Get current locked version
    const db = (await import("./database/schema")).Database.getInstance();
    const lockedRow = db.raw.prepare("SELECT value FROM settings WHERE key = 'locked_commit'").get() as any;
    const baseCommit = lockedRow ? lockedRow.value : "HEAD";

    // Run AI audit
    logger.info("Running AI code audit on " + baseCommit.substring(0, 8) + " -> " + update.substring(0, 8) + "...");
    const audit = await aiAuditor.auditUpgrade(update, baseCommit);

    // Store audit result
    db.raw.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('last_audit_result', ?, ?)")
      .run(JSON.stringify(audit), Date.now());

    if (!audit.passed) {
      logger.warn("Upgrade REJECTED by AI audit: score=" + audit.totalScore + " redFlags=" + audit.redFlags);
      logger.warn("Reason: " + audit.summary);
      return;
    }

    logger.info("AI audit passed: score=" + audit.totalScore + ". Creating voting proposal...");

    // Create voting proposal
    const title = "Upgrade to " + update.substring(0, 12);
    const desc = "AI audit v" + audit.totalScore;
    await governance.createProposal(update, title, desc);
    logger.info("Voting proposal created for " + update.substring(0, 12));
  });

  scheduler.onInternal("task:proposal_tally", async () => {
    await governance.checkAndExecute();
  });

  scheduler.onInternal("task:deployment_health", async () => {
    const results = await healthMonitor.runAllChecks();
    const down = results.filter(r => r.status === "down");
    if (down.length > 0) {
      logger.warn(down.length + " modules down: " + down.map(d => d.module).join(", "));
    }
  });

  // ─── Startup complete ───────────────────────────────────────────────
  const uptime = Date.now() - bootResult.startTime;
  logger.info("==========================================");
  logger.info("  " + config.botName + " v" + config.botVersion + " ONLINE");
  logger.info("  Uptime: " + uptime + "ms");
  logger.info("  Modules: stripe=" + (paymentOk ? "OK" : "-") +
    " sponsor=" + (sponsorOk ? "OK" : "-") +
    " sechat=" + (sechatOk ? "OK" : "-") +
    " domain=" + (domainOk ? "OK" : "-") +
    " deploy=" + (deployOk ? "OK" : "-") +
    " email=" + (emailOk ? "OK" : "-") +
    " usdt=" + (usdtOk ? "OK" : "-"));
  logger.info("  Health monitor: ACTIVE");
  logger.info("==========================================");

  setupGracefulShutdown(stateManager, scheduler, sechatClient, paymentProcessor, healthMonitor, emailAgent);
}

function wireModules(
  paymentProcessor: PaymentProcessor,
  sponsorManager: SponsorManager,
  sechatClient: SeChatClient,
  scheduler: any
): void {
  scheduler.onWebhookEvent("stripe:payment.completed", async (payload: any) => {
    if (!payload.sponsorUserId) return;
    const db = (await import("./database/schema")).Database.getInstance();
    const row = db.raw.prepare("SELECT * FROM payments WHERE id = ?").get(payload.id) as any;
    if (!row || row.status !== "completed") return;
    const paymentRecord = {
      id: row.id, stripePaymentIntentId: row.stripe_payment_intent_id,
      amount: row.amount, currency: "USD",
      status: "completed" as const,
      sponsorUserId: row.sponsor_user_id ?? undefined,
      sponsorUsername: row.sponsor_username ?? undefined,
      metadata: {}, createdAt: Date.now(), completedAt: Date.now(),
    };
    await sponsorManager.processDonation(paymentRecord);
  });

  sponsorManager.onRoleChange = async (record: SponsorRecord, oldRole: SponsorRole): Promise<void> => {
    const success = await sechatClient.setUserSponsorRole(record.sechatUserId, record.currentRole);
    if (success) {
      logger.info("Role synced: " + record.sechatUsername + " -> " + record.currentRole);
    } else {
      logger.error("Failed to sync role for " + record.sechatUsername);
    }
  };
}

function setupGracefulShutdown(
  stateManager: any, scheduler: any, sechatClient: SeChatClient,
  paymentProcessor: PaymentProcessor, healthMonitor: HealthMonitor, emailAgent: EmailAgent
): void {
  async function shutdown(signal: string): Promise<void> {
    logger.info("Shutdown: " + signal);
    scheduler.stop();
    sechatClient.disconnectWebSocket();
    healthMonitor.stop();
    await emailAgent.stop();
    stateManager.stopHealthMonitoring();
    logger.info("Shutdown complete");
    process.exit(0);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[FATAL] Startup failed:", err);
  process.exit(1);
});
