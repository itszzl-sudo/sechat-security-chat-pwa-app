import { getLogger } from "../../config/logger";
import { Database } from "../../database/schema";

const logger = getLogger();

export interface ProposalResult {
  status: "pending" | "approved" | "rejected" | "quorum_failed"
  yesPct: number
  participation: number
  yesWeight: number
  noWeight: number
  totalWeight: number
}

export class GovernanceVoting {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createProposal(commitHash: string, title: string, description: string): Promise<string> {
    const id = "prop_" + Math.random().toString(36).substr(2, 8);
    const now = Date.now();
    const votingEnd = now + 7 * 24 * 60 * 60 * 1000;

    const totalRow = this.db.raw.prepare(
      "SELECT COALESCE(SUM(ROUND(total_donated / 100)), 0) as total FROM sponsors WHERE total_donated > 0"
    ).get() as any;
    const totalPower = Math.max(totalRow?.total || 0, 1);

    this.db.raw.prepare(
      "INSERT INTO upgrade_proposals (id, target_commit, title, description, proposer, created_at, voting_end_at, status, yes_votes, no_votes, total_voting_power) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?)"
    ).run(id, commitHash, title, description, "bot", now, votingEnd, totalPower);

    logger.info("Proposal " + id + " -> " + commitHash.substring(0, 12) + " ends " + new Date(votingEnd).toISOString());
    return id;
  }

  async castVote(proposalId: string, userId: string, username: string, vote: "yes" | "no"): Promise<boolean> {
    const proposal = this.db.raw.prepare(
      "SELECT * FROM upgrade_proposals WHERE id = ? AND status = 'pending'"
    ).get(proposalId) as any;
    if (!proposal) return false;
    if (Date.now() > proposal.voting_end_at) return false;

    const existing = this.db.raw.prepare(
      "SELECT id FROM upgrade_votes WHERE proposal_id = ? AND voter_id = ?"
    ).get(proposalId, userId) as any;
    if (existing) return false;

    const weight = this.getVoterWeight(userId);
    if (weight <= 0) return false;

    const voteId = "vt_" + Math.random().toString(36).substr(2, 8);
    this.db.raw.prepare(
      "INSERT INTO upgrade_votes (id, proposal_id, voter_id, voter_username, vote, weight, voted_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(voteId, proposalId, userId, username, vote, weight, Date.now());

    if (vote === "yes") {
      this.db.raw.prepare("UPDATE upgrade_proposals SET yes_votes = yes_votes + ? WHERE id = ?").run(weight, proposalId);
    } else {
      this.db.raw.prepare("UPDATE upgrade_proposals SET no_votes = no_votes + ? WHERE id = ?").run(weight, proposalId);
    }

    logger.info("Vote: " + username + " (" + weight + "w) -> " + vote + " on " + proposalId);
    return true;
  }

  async tallyProposal(proposalId: string): Promise<ProposalResult> {
    const prop = this.db.raw.prepare("SELECT * FROM upgrade_proposals WHERE id = ?").get(proposalId) as any;
    if (!prop) return { status: "pending", yesPct: 0, participation: 0, yesWeight: 0, noWeight: 0, totalWeight: 0 };

    const totalVoted = (prop.yes_votes || 0) + (prop.no_votes || 0);
    const participation = prop.total_voting_power > 0 ? totalVoted / prop.total_voting_power : 0;
    const yesPct = totalVoted > 0 ? (prop.yes_votes || 0) / totalVoted : 0;

    let status: "pending" | "approved" | "rejected" | "quorum_failed" = "pending";
    if (participation < 0.3) {
      status = "quorum_failed";
    } else if (yesPct >= 0.8) {
      status = "approved";
    } else {
      status = "rejected";
    }

    return { status, yesPct, participation, yesWeight: prop.yes_votes || 0, noWeight: prop.no_votes || 0, totalWeight: prop.total_voting_power };
  }

  async checkAndExecute(): Promise<void> {
    const expired = this.db.raw.prepare(
      "SELECT * FROM upgrade_proposals WHERE status = 'pending' AND voting_end_at < ?"
    ).all(Date.now()) as any[];

    for (const p of expired) {
      const result = await this.tallyProposal(p.id);
      this.db.raw.prepare("UPDATE upgrade_proposals SET status = ? WHERE id = ?").run(result.status, p.id);
      logger.info("Proposal " + p.id + ": " + result.status.toUpperCase() +
        " (" + (result.yesPct * 100).toFixed(1) + "% yes, " + (result.participation * 100).toFixed(1) + "% participation)");

      if (result.status === "approved") {
        logger.info("EXECUTING UPGRADE to " + p.target_commit.substring(0, 12));
        const { execSync } = require("child_process");
        try {
          execSync("git fetch origin main", { stdio: "pipe" });
          execSync("git checkout " + p.target_commit, { stdio: "pipe" });
          execSync("npm install", { stdio: "pipe" });
          execSync("npm run build", { stdio: "pipe" });

          // Re-lock
          this.db.raw.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('locked_commit', ?)").run(p.target_commit);
          logger.info("Upgrade complete. Restarting...");
          process.exit(0);
        } catch (err) {
          logger.error("Upgrade execution failed: " + err);
          this.db.raw.prepare("UPDATE upgrade_proposals SET status = 'failed' WHERE id = ?").run(p.id);
        }
      }
    }
  }

  private getVoterWeight(userId: string): number {
    const sponsor = this.db.raw.prepare(
      "SELECT total_donated FROM sponsors WHERE sechat_user_id = ?"
    ).get(userId) as any;
    if (!sponsor) return 0;
    return Math.max(Math.floor((sponsor.total_donated || 0) / 100), 1);
  }
}
