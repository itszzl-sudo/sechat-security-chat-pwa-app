import { getLogger } from "../../config/logger";
import { Database } from "../../database/schema";
import {
  SponsorRole,
  SponsorRecord,
  RoleThreshold,
  PaymentRecord,
  SPONSOR_ROLE_DISPLAY,
} from "../../types";

const logger = getLogger();

/**
 * SponsorManager tracks donations, checks thresholds, and upgrades sponsor roles.
 * It communicates role changes to the sechat server via a callback.
 */
export class SponsorManager {
  private db: Database;

  /** Callback invoked when a sponsor's role changes. */
  onRoleChange: ((record: SponsorRecord, oldRole: SponsorRole) => Promise<void>) | null = null;

  constructor() {
    this.db = Database.getInstance();
  }

  /**
   * Initialize the sponsor manager. Runs a one-time sync of all sponsors.
   */
  async initialize(): Promise<boolean> {
    try {
      // Verify database connectivity by reading thresholds
      const thresholds = this.getThresholds();
      logger.info(
        `SponsorManager initialized with ${thresholds.length} role thresholds`
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`SponsorManager initialization failed: ${msg}`);
      return false;
    }
  }

  // ─── Sponsor Record Management ────────────────────────────────────────────

  /**
   * Get or create a sponsor record for a sechat user.
   */
  getOrCreateSponsor(
    sechatUserId: string,
    sechatUsername: string
  ): SponsorRecord {
    const existing = this.db.raw
      .prepare("SELECT * FROM sponsors WHERE sechat_user_id = ?")
      .get(sechatUserId) as
      | {
          id: string;
          sechat_user_id: string;
          sechat_username: string;
          total_donated: number;
          current_role: string;
          last_donation_at: number | null;
          first_donation_at: number;
          updated_at: number;
        }
      | undefined;

    if (existing) {
      return this.rowToSponsorRecord(existing);
    }

    // Create new sponsor record
    const { nanoid } = require("nanoid");
    const id = nanoid(16);
    const now = Date.now();

    this.db.raw
      .prepare(
        `INSERT INTO sponsors
           (id, sechat_user_id, sechat_username, total_donated, current_role,
            first_donation_at, updated_at)
         VALUES (?, ?, ?, 0, 'none', ?, ?)`
      )
      .run(id, sechatUserId, sechatUsername, now, now);

    logger.info(`New sponsor record created: ${sechatUsername} (${sechatUserId})`);

    return {
      id,
      sechatUserId,
      sechatUsername,
      totalDonated: 0,
      currentRole: "none",
      firstDonationAt: now,
      updatedAt: now,
    };
  }

  /**
   * Process a payment completion — update the sponsor's total donated amount
   * and check if their role should be upgraded.
   *
   * @returns The updated sponsor record, or null if no sponsor user was linked
   */
  async processDonation(payment: PaymentRecord): Promise<SponsorRecord | null> {
    const userId = payment.sponsorUserId;
    const username = payment.sponsorUsername;

    if (!userId) {
      logger.debug("Payment has no linked sponsor user, skipping role update");
      return null;
    }

    const sponsor = this.getOrCreateSponsor(userId, username ?? "unknown");
    const oldRole = sponsor.currentRole;

    // Update total donated
    const newTotal = sponsor.totalDonated + payment.amount;
    const now = Date.now();

    this.db.raw
      .prepare(
        `UPDATE sponsors SET
           total_donated = ?, last_donation_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(newTotal, now, now, sponsor.id);

    sponsor.totalDonated = newTotal;
    sponsor.lastDonationAt = now;

    // Check if role should change
    const newRole = this.determineRole(newTotal);
    if (newRole !== sponsor.currentRole) {
      await this.updateRole(sponsor, newRole, oldRole);
    }

    logger.info(
      `Donation processed for ${sponsor.sechatUsername}: ` +
        `+$${(payment.amount / 100).toFixed(2)}, ` +
        `total=$${(newTotal / 100).toFixed(2)}, ` +
        `role=${sponsor.currentRole}`
    );

    return sponsor;
  }

  /**
   * Update a sponsor's role and fire the onRoleChange callback.
   */
  private async updateRole(
    sponsor: SponsorRecord,
    newRole: SponsorRole,
    oldRole: SponsorRole
  ): Promise<void> {
    const now = Date.now();

    this.db.raw
      .prepare(
        "UPDATE sponsors SET current_role = ?, updated_at = ? WHERE id = ?"
      )
      .run(newRole, now, sponsor.id);

    sponsor.currentRole = newRole;
    sponsor.updatedAt = now;

    logger.info(
      `Sponsor role changed: ${sponsor.sechatUsername} ` +
        `${SPONSOR_ROLE_DISPLAY[oldRole].badge || "none"} -> ` +
        `${SPONSOR_ROLE_DISPLAY[newRole].badge}`
    );

    // Fire callback to notify sechat server
    if (this.onRoleChange) {
      try {
        await this.onRoleChange(sponsor, oldRole);
      } catch (err) {
        logger.error(
          `Failed to notify sechat server of role change for ${sponsor.sechatUsername}: ${err}`
        );
      }
    }
  }

  // ─── Role Determination ───────────────────────────────────────────────────

  /**
   * Determine the sponsor role based on total donated amount.
   * Iterates thresholds from highest to lowest to find the best match.
   */
  determineRole(totalDonatedCents: number): SponsorRole {
    const thresholds = this.getThresholds();

    // Sort by min amount descending (highest threshold first)
    const sorted = [...thresholds].sort(
      (a, b) => b.minAmountCents - a.minAmountCents
    );

    for (const t of sorted) {
      if (totalDonatedCents >= t.minAmountCents) {
        return t.role;
      }
    }

    return "none";
  }

  /**
   * Get all role thresholds from the database.
   */
  getThresholds(): RoleThreshold[] {
    const rows = this.db.raw
      .prepare("SELECT role, min_amount_cents, description FROM role_thresholds")
      .all() as Array<{
      role: string;
      min_amount_cents: number;
      description: string;
    }>;

    return rows.map((r) => ({
      role: r.role as SponsorRole,
      minAmountCents: r.min_amount_cents,
      description: r.description,
    }));
  }

  /**
   * Update a role threshold.
   */
  setThreshold(role: SponsorRole, minAmountCents: number, description: string): void {
    this.db.raw
      .prepare(
        `INSERT INTO role_thresholds (role, min_amount_cents, description, updated_at)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT(role) DO UPDATE SET
           min_amount_cents = excluded.min_amount_cents,
           description = excluded.description,
           updated_at = unixepoch()`
      )
      .run(role, minAmountCents, description);

    logger.info(`Role threshold updated: ${role} >= $${(minAmountCents / 100).toFixed(2)}`);
  }

  // ─── Sponsor Queries ──────────────────────────────────────────────────────

  /**
   * Get a sponsor record by sechat user ID.
   */
  getSponsorByUserId(sechatUserId: string): SponsorRecord | null {
    const row = this.db.raw
      .prepare("SELECT * FROM sponsors WHERE sechat_user_id = ?")
      .get(sechatUserId) as
      | {
          id: string;
          sechat_user_id: string;
          sechat_username: string;
          total_donated: number;
          current_role: string;
          last_donation_at: number | null;
          first_donation_at: number;
          updated_at: number;
        }
      | undefined;

    return row ? this.rowToSponsorRecord(row) : null;
  }

  /**
   * Get a sponsor record by sechat username.
   */
  getSponsorByUsername(username: string): SponsorRecord | null {
    const row = this.db.raw
      .prepare("SELECT * FROM sponsors WHERE sechat_username = ?")
      .get(username) as
      | {
          id: string;
          sechat_user_id: string;
          sechat_username: string;
          total_donated: number;
          current_role: string;
          last_donation_at: number | null;
          first_donation_at: number;
          updated_at: number;
        }
      | undefined;

    return row ? this.rowToSponsorRecord(row) : null;
  }

  /**
   * Get all sponsor records, ordered by total donated descending.
   */
  getAllSponsors(limit = 50): SponsorRecord[] {
    const rows = this.db.raw
      .prepare(
        "SELECT * FROM sponsors ORDER BY total_donated DESC LIMIT ?"
      )
      .all(limit) as Array<{
      id: string;
      sechat_user_id: string;
      sechat_username: string;
      total_donated: number;
      current_role: string;
      last_donation_at: number | null;
      first_donation_at: number;
      updated_at: number;
    }>;

    return rows.map((r) => this.rowToSponsorRecord(r));
  }

  /**
   * Sync all sponsors' roles based on their total donated amounts.
   * This is a reconciliation operation — called periodically.
   */
  async syncAllRoles(): Promise<number> {
    const sponsors = this.getAllSponsors(1000);
    let changes = 0;

    for (const sponsor of sponsors) {
      const correctRole = this.determineRole(sponsor.totalDonated);
      if (correctRole !== sponsor.currentRole) {
        const oldRole = sponsor.currentRole;
        await this.updateRole(sponsor, correctRole, oldRole);
        changes++;
      }
    }

    if (changes > 0) {
      logger.info(`Role sync complete: ${changes}/${sponsors.length} roles updated`);
    }

    return changes;
  }

  /**
   * Get aggregate sponsor statistics.
   */
  getStats(): {
    totalSponsors: number;
    totalDonated: number;
    roleDistribution: Record<string, number>;
  } {
    const count = this.db.raw
      .prepare("SELECT COUNT(*) AS c FROM sponsors")
      .get() as { c: number };

    const total = this.db.raw
      .prepare(
        "SELECT COALESCE(SUM(total_donated), 0) AS total FROM sponsors"
      )
      .get() as { total: number };

    const roles = this.db.raw
      .prepare(
        "SELECT current_role, COUNT(*) AS cnt FROM sponsors GROUP BY current_role"
      )
      .all() as Array<{ current_role: string; cnt: number }>;

    const roleDistribution: Record<string, number> = {};
    for (const r of roles) {
      roleDistribution[r.current_role] = r.cnt;
    }

    return {
      totalSponsors: count.c,
      totalDonated: total.total,
      roleDistribution,
    };
  }

  // ─── Converters ───────────────────────────────────────────────────────────

  private rowToSponsorRecord(row: {
    id: string;
    sechat_user_id: string;
    sechat_username: string;
    total_donated: number;
    current_role: string;
    last_donation_at: number | null;
    first_donation_at: number;
    updated_at: number;
  }): SponsorRecord {
    return {
      id: row.id,
      sechatUserId: row.sechat_user_id,
      sechatUsername: row.sechat_username,
      totalDonated: row.total_donated,
      currentRole: row.current_role as SponsorRole,
      lastDonationAt: row.last_donation_at ?? undefined,
      firstDonationAt: row.first_donation_at,
      updatedAt: row.updated_at,
    };
  }
}
