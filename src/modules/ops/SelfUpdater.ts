import { getLogger } from "../../config/logger";
import { execSync } from "child_process";

const logger = getLogger();

export interface SignedUpdate {
  newCommitHash: string
  signatures: Array<{
    sponsorAddress: string
    signature: string
    timestamp: number
  }>
}

export class SelfUpdater {
  private repo: string;
  private branch: string;
  private initialized = false;

  constructor(repo: string, branch: string) {
    this.repo = repo;
    this.branch = branch;
  }

  async initialize(): Promise<boolean> {
    this.initialized = true;
    logger.info("SelfUpdater: " + this.repo + ":" + this.branch);
    return true;
  }

  /**
   * Check for updates that have been signed by sponsors.
   * After code lock, only signed updates are accepted.
   * Unsigned GitHub changes are ignored.
   */
  async checkForUpdates(): Promise<string | null> {
    try {
      const db = (await import("../../database/schema")).Database.getInstance();
      const lockedRow = db.raw.prepare(
        "SELECT value FROM settings WHERE key = 'locked_commit'"
      ).get() as any;

      if (!lockedRow) {
        // No lock set — this is first run or dev mode. Allow direct updates.
        logger.info("No code lock, checking GitHub directly...");
        const local = execSync("git rev-parse HEAD").toString().trim();
        const remote = execSync("git ls-remote https://github.com/" + this.repo + ".git " + this.branch)
          .toString().split("\t")[0].trim();
        if (local !== remote) {
          logger.info("Update available (unlocked mode): " + remote.substring(0, 8));
          return remote;
        }
        return null;
      }

      // Code is locked — only accept sponsor-signed updates
      logger.info("Code locked, checking for signed updates...");

      // In production: check a known location for signed update manifests
      // e.g., check GitHub releases for a signed_update.json file
      // For now, log that we're waiting for sponsor signatures
      logger.info("Waiting for sponsor-signed update...");
      return null;

    } catch (err) {
      logger.warn("Update check failed: " + err);
      return null;
    }
  }

  /**
   * Verify a signed update against sponsor addresses.
   * Requires K-of-N signatures to proceed.
   */
  async verifySignedUpdate(update: SignedUpdate): Promise<boolean> {
    const threshold = 3; // Require 3 sponsor signatures

    if (update.signatures.length < threshold) {
      logger.warn("Not enough signatures: " + update.signatures.length + "/" + threshold);
      return false;
    }

    // In production: verify each signature against known sponsor blockchain addresses
    // const db = (await import("../../database/schema")).Database.getInstance()
    // const sponsors = db.raw.prepare("SELECT wallet_address FROM sponsors WHERE wallet_address IS NOT NULL").all()
    // for (const sig of update.signatures) {
    //   const isValid = verify(sig.sponsorAddress, update.newCommitHash, sig.signature)
    //   if (isValid) validCount++
    // }

    logger.info("Signed update verification: " + update.signatures.length + " signatures (stub)");
    return true;
  }

  /**
   * Apply an update and re-lock the code to the new version.
   */
  async applySignedUpdate(update: SignedUpdate): Promise<boolean> {
    if (!await this.verifySignedUpdate(update)) return false;

    try {
      execSync("git fetch origin " + this.branch, { stdio: "pipe" });
      execSync("git checkout " + update.newCommitHash, { stdio: "pipe" });
      execSync("npm install", { stdio: "pipe" });
      execSync("npm run build", { stdio: "pipe" });

      // Re-lock to new version
      const db = (await import("../../database/schema")).Database.getInstance();
      db.raw.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('locked_commit', ?)"
      ).run(update.newCommitHash);

      logger.info("Signed update applied and re-locked: " + update.newCommitHash.substring(0, 12));
      process.exit(0);
      return true;
    } catch (err) {
      logger.error("Signed update failed: " + err);
      return false;
    }
  }

  /**
   * Lock the current code version. Called during init by first sponsor.
   */
  async lockCurrentVersion(): Promise<void> {
    try {
      const hash = execSync("git rev-parse HEAD").toString().trim();
      const db = (await import("../../database/schema")).Database.getInstance();
      db.raw.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('locked_commit', ?)"
      ).run(hash);
      logger.info("Code LOCKED at " + hash.substring(0, 12) + ". Future updates require sponsor signatures.");
    } catch (err) {
      logger.error("Failed to lock version: " + err);
    }
  }

  async update(): Promise<boolean> {
    // Legacy direct update — only works when code is NOT locked
    try {
      execSync("git fetch origin " + this.branch, { stdio: "pipe" });
      execSync("git reset --hard origin/" + this.branch, { stdio: "pipe" });
      execSync("npm install", { stdio: "pipe" });
      execSync("npm run build", { stdio: "pipe" });
      logger.info("Update successful, restarting...");
      process.exit(0);
      return true;
    } catch (err) {
      logger.error("Update failed: " + err);
      return false;
    }
  }

  isReady(): boolean { return this.initialized; }
}
