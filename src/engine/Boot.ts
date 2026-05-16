import { BotConfig, DeploymentState, ModuleHealth } from "../types";
import { getLogger, initLogger } from "../config/logger";
import { loadConfig, sanitizeConfig } from "../config";
import { Database } from "../database/schema";
import { StateManager } from "./StateManager";
import { Scheduler } from "./Scheduler";

const logger = getLogger();

/**
 * Result of the boot sequence, returned to the entry point.
 */
export interface BootResult {
  config: BotConfig;
  stateManager: StateManager;
  scheduler: Scheduler;
  startTime: number;
}

/**
 * Boot loader that checks deployment state, initializes modules, and runs
 * self-test diagnostics. This is the first component executed at startup.
 */
export class Boot {
  private config!: BotConfig;
  private stateManager!: StateManager;
  private scheduler!: Scheduler;
  private startTime!: number;

  // Health tracking
  private modules: Array<{
    name: string;
    init: () => Promise<boolean>;
    deps: string[];
  }> = [];

  /**
   * Run the full boot sequence:
   * 1. Load configuration
   * 2. Initialize logging
   * 3. Connect to database
   * 4. Initialize state manager
   * 5. Initialize scheduler
   * 6. Register and initialize all modules
   * 7. Run self-test
   * 8. Start background tasks
   */
  async boot(): Promise<BootResult> {
    this.startTime = Date.now();

    // ── Step 1: Load config ────────────────────────────────────────────────
    console.log("[Boot] Loading configuration...");
    this.config = loadConfig();
    console.log("[Boot] Configuration loaded:", JSON.stringify(sanitizeConfig(this.config), null, 2));

    // ── Step 2: Initialize logging ─────────────────────────────────────────
    initLogger(this.config.logLevel, this.config.logFile);

    logger.info("==============================================");
    logger.info(`  ${this.config.botName} v${this.config.botVersion}`);
    logger.info(`  Environment: ${this.config.nodeEnv}`);
    logger.info("==============================================");

    // ── Step 3: Database ──────────────────────────────────────────────────
    logger.info("[Boot] Initializing database...");
    Database.getInstance(this.config);
    logger.info("[Boot] Database ready");

    // ── Step 3.5: Code Lock Verification ────────────────────────────────────
    logger.info("[Boot] Verifying code lock...");
    try {
      const db = Database.getInstance();
      const lockedRow = db.raw.prepare(
        "SELECT value FROM settings WHERE key = 'locked_commit'"
      ).get() as any;

      if (lockedRow) {
        const lockedHash = lockedRow.value;
        const { execSync } = require("child_process");
        const currentHash = execSync("git rev-parse HEAD").toString().trim();

        if (currentHash !== lockedHash) {
          logger.error("CODE TAMPERED! Locked: " + lockedHash.substring(0, 12) + " Current: " + currentHash.substring(0, 12));
          logger.error("This bot is locked to a specific version. Updates require Sponsor multi-signature.");
          process.exit(1);
        }
        logger.info("Code integrity OK: " + currentHash.substring(0, 12));
      } else {
        logger.info("No code lock set. This is normal for first run.");
      }
    } catch (err) {
      logger.warn("Code lock verification skipped (not a git repo or other error): " + err);
    }

    // ── Step 4: State Manager ─────────────────────────────────────────────
    logger.info("[Boot] Initializing StateManager...");
    this.stateManager = new StateManager();
    this.stateManager.registerModule("core");
    logger.info("[Boot] StateManager ready");

    // ── Step 5: Scheduler ─────────────────────────────────────────────────
    logger.info("[Boot] Initializing Scheduler...");
    this.scheduler = new Scheduler(this.stateManager);
    logger.info("[Boot] Scheduler ready");

    // ── Step 6: Register modules ─────────────────────────────────────────
    await this.registerModules();

    // ── Step 7: Initialize modules ────────────────────────────────────────
    await this.initializeModules();

    // ── Step 8: Self-test ─────────────────────────────────────────────────
    await this.runSelfTest();

    // ── Step 9: Start scheduler ──────────────────────────────────────────
    this.scheduler.start();

    const elapsed = Date.now() - this.startTime;
    logger.info(`[Boot] Boot sequence complete in ${elapsed}ms`);

    // Mark deployment as operational if not yet set
    const depState = this.stateManager.getDeploymentState();
    if (depState.phase === "none") {
      this.stateManager.updateDeployment("payment", "boot_complete");
      logger.info("[Boot] Initial deployment phase set to 'payment'");
    }

    return {
      config: this.config,
      stateManager: this.stateManager,
      scheduler: this.scheduler,
      startTime: this.startTime,
    };
  }

  /**
   * Get the current config (available after boot).
   */
  getConfig(): BotConfig {
    return this.config;
  }

  /**
   * Get the state manager (available after boot).
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get the scheduler (available after boot).
   */
  getScheduler(): Scheduler {
    return this.scheduler;
  }

  // ─── Module Registration ──────────────────────────────────────────────────

  /**
   * Register a module to be initialized during boot.
   * Modules are initialized in dependency order.
   */
  registerModule(name: string, initFn: () => Promise<boolean>, deps: string[] = []): void {
    this.modules.push({ name, init: initFn, deps });
    this.stateManager.registerModule(name);
    logger.info(`[Boot] Module registered: ${name} (deps: ${deps.join(", ") || "none"})`);
  }

  private async registerModules(): Promise<void> {
    // This is a hook for modules to self-register.
    // The actual registration happens when modules are imported in index.ts.
    logger.info(`[Boot] Module registry ready (${this.modules.length} modules registered)`);
  }

  /**
   * Initialize all registered modules in dependency order (topological sort).
   */
  private async initializeModules(): Promise<void> {
    if (this.modules.length === 0) {
      logger.info("[Boot] No modules to initialize");
      return;
    }

    // Topological sort by dependencies
    const sorted = this.topologicalSort();
    logger.info(`[Boot] Initializing modules in order: ${sorted.join(" -> ")}`);

    for (const name of sorted) {
      const mod = this.modules.find((m) => m.name === name);
      if (!mod) continue;

      try {
        const taskId = this.stateManager.startTask(`init:${name}`);
        const success = await mod.init();
        if (success) {
          this.stateManager.completeTask(taskId, "Module initialized successfully");
          this.stateManager.reportHealth(name, "healthy");
          logger.info(`[Boot] Module initialized: ${name}`);
        } else {
          this.stateManager.failTask(taskId, "Module initialization returned false");
          this.stateManager.reportHealth(name, "degraded", "Init returned false");
          logger.warn(`[Boot] Module initialized with warnings: ${name}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.stateManager.reportHealth(name, "down", msg);
        logger.error(`[Boot] Module failed to initialize: ${name} - ${msg}`);
        // Do not throw — let other modules try to initialize
      }
    }
  }

  /**
   * Topological sort of modules based on dependencies.
   * Throws if a circular dependency is detected.
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving module: ${name}`);
      }
      visiting.add(name);

      const mod = this.modules.find((m) => m.name === name);
      if (mod) {
        for (const dep of mod.deps) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const mod of this.modules) {
      if (!visited.has(mod.name)) {
        visit(mod.name);
      }
    }

    return result;
  }

  // ─── Self-Test ────────────────────────────────────────────────────────────

  /**
   * Run boot-time self-test diagnostics.
   */
  private async runSelfTest(): Promise<void> {
    logger.info("[Boot] Running self-test...");
    const testTaskId = this.stateManager.startTask("self_test");
    const tests: Array<{ name: string; test: () => Promise<boolean> }> = [
      {
        name: "config_loaded",
        test: async () => {
          const cfg = this.config;
          return (
            typeof cfg.botName === "string" &&
            typeof cfg.sechatServerUrl === "string" &&
            cfg.sechatServerUrl.length > 0
          );
        },
      },
      {
        name: "database_connected",
        test: async () => {
          try {
            const row = Database.getInstance().raw
              .prepare("SELECT 1 AS ok")
              .get() as { ok: number };
            return row.ok === 1;
          } catch {
            return false;
          }
        },
      },
      {
        name: "state_manager_ready",
        test: async () => {
          const dep = this.stateManager.getDeploymentState();
          return dep.phase !== undefined;
        },
      },
      {
        name: "scheduler_ready",
        test: async () => {
          return typeof this.scheduler.getTaskStatus === "function";
        },
      },
    ];

    let allPassed = true;
    for (const t of tests) {
      try {
        const passed = await t.test();
        if (passed) {
          logger.info(`  [SELF-TEST] ✓ ${t.name}`);
        } else {
          logger.warn(`  [SELF-TEST] ✗ ${t.name} FAILED`);
          allPassed = false;
        }
      } catch (err) {
        logger.error(`  [SELF-TEST] ✗ ${t.name} ERROR: ${err}`);
        allPassed = false;
      }
    }

    if (allPassed) {
      this.stateManager.completeTask(testTaskId, "All self-tests passed");
      this.stateManager.reportHealth("core", "healthy");
      logger.info("[Boot] Self-test: ALL PASSED");
    } else {
      this.stateManager.failTask(testTaskId, "Some self-tests failed");
      this.stateManager.reportHealth("core", "degraded", "Self-test failures");
      logger.warn("[Boot] Self-test: SOME FAILED");
    }
  }
}
