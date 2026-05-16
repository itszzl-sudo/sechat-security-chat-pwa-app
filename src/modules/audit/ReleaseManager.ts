import { getLogger } from "../../config/logger";
import { execSync } from "child_process";

const logger = getLogger();

export class ReleaseManager {
  private initialized = false;
  async initialize(): Promise<boolean> { this.initialized = true; logger.info("ReleaseManager initialized"); return true; }

  getReleaseNotes(fromVersion: string, toVersion: string): string {
    try {
      const log = execSync("git log " + fromVersion + ".." + toVersion + " --oneline --no-decorate", { maxBuffer: 1024*1024 }).toString();
      const nls = String.fromCharCode(10);
      let notes = "## Commits" + nls + log;
      return notes;
    } catch (err) { logger.warn("Release notes: " + err); return ""; }
  }

  getRoadmap(): string {
    try { return execSync("cat ROADMAP.md 2>/dev/null || cat PLANS.md 2>/dev/null || echo \"\"", { maxBuffer: 1024*1024 }).toString(); }
    catch { return ""; }
  }

  async notifySeChat(sechatClient: any, title: string, content: string): Promise<boolean> {
    logger.info("Notify sechat: " + title);
    return true;
  }

  isReady(): boolean { return this.initialized; }
}
