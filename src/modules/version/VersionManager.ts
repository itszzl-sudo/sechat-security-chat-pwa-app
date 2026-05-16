import { getLogger } from "../../config/logger";
import { Database } from "../../database/schema";
import { VersionRecord, VersionHeartbeat } from "../../types";

const logger = getLogger();

export class VersionManager {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async initialize(): Promise<boolean> {
    logger.info("VersionManager initialized");
    return true;
  }

  // Record a heartbeat from a running sechat instance
  recordHeartbeat(hb: VersionHeartbeat): void {
    const existing = this.db.raw.prepare(
      "SELECT * FROM version_tracking WHERE version = ?"
    ).get(hb.version) as any;

    const activeUsers = JSON.parse(existing?.active_users || "[]") as string[];
    if (!activeUsers.includes(hb.userId)) {
      activeUsers.push(hb.userId);
    }

    const now = Date.now();
    if (existing) {
      this.db.raw.prepare(
        "UPDATE version_tracking SET user_count = ?, last_heartbeat_at = ?, active_users = ? WHERE version = ?"
      ).run(activeUsers.length, now, JSON.stringify(activeUsers), hb.version);
    } else {
      this.db.raw.prepare(
        "INSERT INTO version_tracking (version, commit_hash, deployed_at, status, user_count, daily_active_users, adoption_pct, last_heartbeat_at, active_users) VALUES (?, ?, ?, 'active', 1, 0, 0, ?, ?)"
      ).run(hb.version, hb.version, now, now, JSON.stringify([hb.userId]));
    }

    logger.debug("Heartbeat: " + hb.version + " user=" + hb.username);
  }

  // Calculate daily active users and adoption percentages
  async calculateMetrics(): Promise<VersionRecord[]> {
    const versions = this.db.raw.prepare(
      "SELECT * FROM version_tracking WHERE status = 'active'"
    ).all() as any[];

    const now = Date.now();
    const day = 86400000;
    const totalUsers = versions.reduce((s: number, v: any) => s + v.user_count, 0);

    for (const v of versions) {
      const activeUsers: string[] = JSON.parse(v.active_users || "[]");
      const daily = activeUsers.filter(u => {
        const lastHb = this.db.raw.prepare(
          "SELECT MAX(timestamp) as ts FROM version_heartbeats WHERE user_id = ? AND version = ?"
        ).get(u, v.version) as any;
        return lastHb?.ts && (now - lastHb.ts) < day;
      }).length;

      const pct = totalUsers > 0 ? Math.round((v.user_count / totalUsers) * 100) : 0;
      this.db.raw.prepare(
        "UPDATE version_tracking SET daily_active_users = ?, adoption_pct = ? WHERE version = ?"
      ).run(daily, pct, v.version);
    }

    return this.db.raw.prepare("SELECT * FROM version_tracking ORDER BY deployed_at DESC").all() as VersionRecord[];
  }

  // Decide if a version should be deprecated
  async evaluateDeprecation(): Promise<{ version: string; action: "keep" | "warn" | "deprecate" | "sunset" }[]> {
    const versions = await this.calculateMetrics();
    const results: any[] = [];

    for (const v of versions) {
      if (v.status !== "active") continue;
      const age = Date.now() - v.deployedAt;
      const ageDays = age / 86400000;

      // New version with high adoption -> deprecate old
      // Old version with low adoption -> deprecate
      if (v.adoptionPct > 50 && ageDays > 14) {
        // This version is dominant, deprecate older ones
        const older = versions.filter(o =>
          o.deployedAt < v.deployedAt && o.status === "active" && o.adoptionPct < 20
        );
        for (const old of older) {
          results.push({ version: old.version, action: "deprecate" });
        }
      }

      if (v.adoptionPct < 5 && ageDays > 60) {
        results.push({ version: v.version, action: "sunset" });
      }
    }

    return results;
  }

  // Execute deprecation actions
  async executeDeprecation(): Promise<void> {
    const decisions = await this.evaluateDeprecation();
    for (const d of decisions) {
      logger.info("Version " + d.version + " -> " + d.action);
      if (d.action === "deprecate") {
        this.db.raw.prepare("UPDATE version_tracking SET status = 'deprecated' WHERE version = ?").run(d.version);
      }
      if (d.action === "sunset") {
        this.db.raw.prepare("UPDATE version_tracking SET status = 'sunset' WHERE version = ?").run(d.version);
        // TODO: undeploy this version from VPS
      }
    }
  }

  isReady(): boolean { return true; }
}