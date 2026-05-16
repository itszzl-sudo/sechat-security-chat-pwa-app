import DatabaseImport from "better-sqlite3";
import path from "path";
import { BotConfig, RoleThreshold, SponsorRole } from "../types";
import { getLogger } from "../config/logger";
const logger = getLogger();

// ─── Default Role Thresholds (in USD cents) ──────────────────────────────────

export const DEFAULT_ROLE_THRESHOLDS: RoleThreshold[] = [
  { role: "general_sponsor", minAmountCents: 100, description: "$1+ donation" },
  {
    role: "senior_sponsor",
    minAmountCents: 1000,
    description: "$10+ total donated",
  },
  {
    role: "core_sponsor",
    minAmountCents: 5000,
    description: "$50+ total donated",
  },
  {
    role: "sole_exclusive_sponsor",
    minAmountCents: 25000,
    description: "$250+ total donated",
  },
  {
    role: "reserve_fund_sponsor",
    minAmountCents: 100000,
    description: "$1,000+ total donated",
  },
];
type BetterSqlite3 = DatabaseImport.Database;

/**
 * Singleton wrapper around better-sqlite3 database.
 * Creates tables on first connection if they don't exist.
 */
export class Database {
  private db: BetterSqlite3;
  private static instance: Database;

  private constructor(config: BotConfig) {
    const dbPath = path.resolve(config.databasePath);
    this.db = new DatabaseImport(dbPath, {
      /* verbose: console.log // uncomment for debugging */
    });

    // Enable WAL mode for better concurrent performance
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.createTables();
    this.seedDefaults();
    logger.info(`Database initialized at ${dbPath}`);
  }

  /**
   * Get or create the singleton Database instance.
   */
  static getInstance(config?: BotConfig): Database {
    if (!Database.instance) {
      if (!config) {
        throw new Error(
          "Database not initialized. Call Database.getInstance(config) first.",
        );
      }
      Database.instance = new Database(config);
    }
    return Database.instance;
  }

  /**
   * Return the underlying better-sqlite3 instance for direct queries.
   */
  get raw(): BetterSqlite3 {
    return this.db;
  }

  // ─── Table Creation ──────────────────────────────────────────────────────────

  private createTables(): void {
    this.db.exec(`
      -- Domain records (Phase 2)
      CREATE TABLE IF NOT EXISTS domains (
        id            TEXT PRIMARY KEY,
        domain        TEXT NOT NULL UNIQUE,
        registrar     TEXT NOT NULL CHECK(registrar IN ('namesilo','cloudflare')),
        whois_email   TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','active','expiring','expired','transferred')),
        registered_at INTEGER NOT NULL,
        expires_at    INTEGER NOT NULL,
        auto_renew    INTEGER NOT NULL DEFAULT 1,
        dns_configured INTEGER NOT NULL DEFAULT 0,
        verified      INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Payment / Donation records
      CREATE TABLE IF NOT EXISTS payments (
        id                    TEXT PRIMARY KEY,
        stripe_payment_intent_id TEXT NOT NULL UNIQUE,
        stripe_customer_id    TEXT,
        amount                INTEGER NOT NULL,
        currency              TEXT NOT NULL DEFAULT 'usd',
        status                TEXT NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','completed','failed','refunded')),
        sponsor_user_id       TEXT,
        sponsor_username      TEXT,
        metadata              TEXT NOT NULL DEFAULT '{}',
        created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
        completed_at          INTEGER
      );

      -- Sponsor records (one per sechat user)
      CREATE TABLE IF NOT EXISTS sponsors (
        id                TEXT PRIMARY KEY,
        sechat_user_id    TEXT NOT NULL UNIQUE,
        sechat_username   TEXT NOT NULL,
        total_donated     INTEGER NOT NULL DEFAULT 0,
        current_role      TEXT NOT NULL DEFAULT 'none'
                          CHECK(current_role IN (
                            'none','general_sponsor','senior_sponsor',
                            'core_sponsor','sole_exclusive_sponsor',
                            'reserve_fund_sponsor'
                          )),
        last_donation_at  INTEGER,
        first_donation_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Role thresholds (configurable)
      CREATE TABLE IF NOT EXISTS role_thresholds (
        role            TEXT PRIMARY KEY
                        CHECK(role IN (
                          'none','general_sponsor','senior_sponsor',
                          'core_sponsor','sole_exclusive_sponsor',
                          'reserve_fund_sponsor'
                        )),
        min_amount_cents INTEGER NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Deployment state (singleton row, key = 'deployment')
      CREATE TABLE IF NOT EXISTS deployment_state (
        key         TEXT PRIMARY KEY,
        phase       TEXT NOT NULL DEFAULT 'none'
                    CHECK(phase IN ('none','seeding','domain','infra','payment','operational')),
        step        TEXT NOT NULL DEFAULT '',
        started_at  INTEGER,
        completed_at INTEGER,
        error       TEXT,
        metadata    TEXT NOT NULL DEFAULT '{}',
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Module health tracking
      CREATE TABLE IF NOT EXISTS module_health (
        module_name   TEXT PRIMARY KEY,
        status        TEXT NOT NULL DEFAULT 'healthy'
                      CHECK(status IN ('healthy','degraded','down')),
        last_check_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_error    TEXT,
        uptime_ms     INTEGER NOT NULL DEFAULT 0,
        metadata      TEXT NOT NULL DEFAULT '{}'
      );

      -- Task logs
      CREATE TABLE IF NOT EXISTS task_logs (
        id          TEXT PRIMARY KEY,
        task_name   TEXT NOT NULL,
        status      TEXT NOT NULL CHECK(status IN ('running','success','failure','skipped')),
        started_at  INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        error       TEXT,
        details     TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Settings (key-value store)
      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- Startup loan (repayment mechanism, Phase 2)
      CREATE TABLE IF NOT EXISTS startup_loans (
        funder_address        TEXT PRIMARY KEY,
        principal_amount_usdt INTEGER NOT NULL,
        contributed_at        INTEGER NOT NULL,
        status                TEXT NOT NULL DEFAULT 'active'
                              CHECK(status IN ('active','repaying','repaid','defaulted')),
        total_repaid          INTEGER NOT NULL DEFAULT 0,
        last_repayment_at     INTEGER,
        repaid_at             INTEGER
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_sponsor ON payments(sponsor_user_id);
      CREATE INDEX IF NOT EXISTS idx_sponsors_total_donated ON sponsors(total_donated);
      CREATE INDEX IF NOT EXISTS idx_task_logs_name ON task_logs(task_name);
      CREATE INDEX IF NOT EXISTS idx_task_logs_status ON task_logs(status);
      CREATE INDEX IF NOT EXISTS idx_task_logs_started ON task_logs(started_at);
    `);
  }

  // ─── Default Seed Data ──────────────────────────────────────────────────────

  private seedDefaults(): void {
    // Seed role thresholds if table is empty
    const count = this.db
      .prepare("SELECT COUNT(*) as c FROM role_thresholds")
      .get() as { c: number };

    if (count.c === 0) {
      const insert = this.db.prepare(
        "INSERT OR IGNORE INTO role_thresholds (role, min_amount_cents, description) VALUES (?, ?, ?)",
      );
      const tx = this.db.transaction(() => {
        for (const t of DEFAULT_ROLE_THRESHOLDS) {
          insert.run(t.role, t.minAmountCents, t.description);
        }
      });
      tx();
      logger.info("Seeded default role thresholds");
    }

    // Seed deployment state if not present
    const deployExists = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM deployment_state WHERE key = 'deployment'",
      )
      .get() as { c: number };

    if (deployExists.c === 0) {
      this.db
        .prepare(
          "INSERT INTO deployment_state (key, phase, step, metadata) VALUES ('deployment', 'none', 'initial', '{}')",
        )
        .run();
      logger.info("Seeded initial deployment state");
    }
  }

  // ─── Close ──────────────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
    logger.info("Database connection closed");
  }
}
