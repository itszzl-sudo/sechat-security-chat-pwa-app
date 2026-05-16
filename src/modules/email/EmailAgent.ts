import { IMAPClient } from "./IMAPClient";
import { SMTPClient } from "./SMTPClient";
import { getLogger } from "../../config/logger";
const logger = getLogger();
export class EmailAgent {
  private imap: IMAPClient[] = [];
  private smtp: SMTPClient | null = null;
  private initialized = false;
  private pollTimer: any = null;
  async initialize(): Promise<boolean> {
    const config = (await import("../../config/index")).loadConfig();
    if (!config.imapHost || !config.imapUser || !config.imapPassword) return false;
    this.smtp = new SMTPClient(config.smtpHost || config.imapHost, config.smtpPort || 465, config.smtpUser || config.imapUser, config.smtpPassword || config.imapPassword);
    await this.smtp.connect();
    this.imap.push(new IMAPClient(config.imapHost, config.imapPort || 993, config.imapUser, config.imapPassword));
    for (const c of this.imap) await c.connect();
    this.initialized = true;
    this.startPolling();
    return true;
  }
  private startPolling() {
    this.pollTimer = setInterval(async () => {
      for (const c of this.imap) {
        const emails = await c.fetchUnseen();
        for (const email of emails) {
          const link = await c.extractVerificationLink(email);
          if (link) { await c.confirmEmail(email.body); await this.smtp?.sendVerificationConfirmation(link.domain, link.registrar); }
        }
      }
    }, 300000);
  }
  async stop() { clearInterval(this.pollTimer); for (const c of this.imap) await c.disconnect(); await this.smtp?.disconnect(); }
  isReady(): boolean { return this.initialized; }
}