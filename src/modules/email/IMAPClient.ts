import { getLogger } from "../../config/logger";
const logger = getLogger();

export class IMAPClient {
  private connected = false;

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string
  ) {}

  async connect(): Promise<boolean> {
    logger.info("IMAP connect: " + this.user + "@" + this.host);
    this.connected = true;
    return true;
  }

  async fetchUnseen(): Promise<any[]> {
    if (!this.connected) return [];
    return [];
  }

  async extractVerificationLink(email: any): Promise<any | null> {
    const body = email.body || '';
    const idx = body.indexOf('http');
    if (idx === -1) return null;
    const end = body.indexOf(' ', idx);
    const url = end === -1 ? body.substring(idx) : body.substring(idx, end);
    if (url.includes('verify') || url.includes('confirm')) {
      return {
        url: url,
        domain: (email.from || '').split('@')[1] || '',
        registrar: (email.from || '').includes('namesilo') ? 'namesilo' : 'cloudflare',
        email: email.to,
        type: 'whois_verification',
      };
    }
    return null;
  }

  async confirmEmail(body: string): Promise<boolean> {
    const urls: string[] = [];
    let idx = body.indexOf('http');
    while (idx !== -1) {
      const end = body.indexOf(' ', idx);
      urls.push(end === -1 ? body.substring(idx) : body.substring(idx, end));
      idx = body.indexOf('http', idx + 1);
    }
    for (const url of urls) {
      if (url.includes('verify') || url.includes('confirm')) {
        logger.info("Confirm: " + url.substring(0, 80));
        return true;
      }
    }
    return false;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }
}
