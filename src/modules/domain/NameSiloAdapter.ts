import axios from "axios";
import { RegistrarAdapter, CheckResult, DomainInfo } from "./RegistrarAdapter";
import { DNSRecord } from "../../types";
import { getLogger } from "../../config/logger";

const logger = getLogger();

export class NameSiloAdapter implements RegistrarAdapter {
  readonly name = "namesilo"
  readonly priority = 2
  private baseUrl = "https://www.namesilo.com/api";

  constructor(private apiKey: string) {}

  async testConnection(): Promise<boolean> {
    try {
      const r = await axios.get(this.baseUrl + "/getAccountBalance", {
        params: { key: this.apiKey, version: 1, type: "xml" },
        timeout: 15000,
      });
      return (r.data as string).includes("<reply>");
    } catch { return false; }
  }

  async checkDomain(domain: string): Promise<CheckResult> {
    try {
      const r = await axios.get(this.baseUrl + "/checkRegisterDomain", {
        params: { key: this.apiKey, domain, version: 1, type: "xml" },
        timeout: 15000,
      });
      const data = r.data as string;
      return { available: data.includes("<available>yes</available>") };
    } catch { return { available: false }; }
  }

  async registerDomain(domain: string, years: number = 1, whoisEmail: string): Promise<boolean> {
    try {
      const r = await axios.get(this.baseUrl + "/registerDomain", {
        params: {
          key: this.apiKey, domain, years, private: 1, auto_renew: 1,
          fn: "SeChatbot", ln: "Admin",
          ad: "123 Bot Street", cy: "Singapore", st: "Singapore",
          zp: "123456", ct: "SG",
          email: whoisEmail, version: 1, type: "xml",
        },
        timeout: 30000,
      });
      const ok = !(r.data as string).includes("<code>0</code>");
      logger.info("NameSilo register " + domain + ": " + (ok ? "OK" : "FAIL"));
      return ok;
    } catch (err) { logger.error("NameSilo register failed: " + err); return false; }
  }

  async setWhoisEmail(domain: string, email: string): Promise<boolean> {
    try {
      const r = await axios.get(this.baseUrl + "/domainUpdate", {
        params: { key: this.apiKey, domain, email, version: 1, type: "xml" },
        timeout: 15000,
      });
      return (r.data as string).includes("<code>300</code>");
    } catch { return false; }
  }

  async setDNSRecords(domain: string, records: DNSRecord[]): Promise<boolean> {
    try {
      for (const rec of records) {
        await axios.get(this.baseUrl + "/dnsAddRecord", {
          params: { key: this.apiKey, domain, rrtype: rec.type, rrhost: rec.name, rrvalue: rec.content, rrtl: rec.ttl || 7200, version: 1, type: "xml" },
          timeout: 15000,
        });
      }
      return true;
    } catch { return false; }
  }

  async enableAutoRenew(domain: string, enabled: boolean): Promise<boolean> {
    try {
      await axios.get(this.baseUrl + "/configureAutoRenew", {
        params: { key: this.apiKey, domain, autorenew: enabled ? 1 : 0, version: 1, type: "xml" },
        timeout: 15000,
      });
      return true;
    } catch { return false; }
  }

  async getDomainInfo(domain: string): Promise<DomainInfo | null> {
    try {
      const r = await axios.get(this.baseUrl + "/getDomainInfo", {
        params: { key: this.apiKey, domain, version: 1, type: "xml" },
        timeout: 15000,
      });
      const data = r.data as string;
      if (data.includes("<code>300</code>")) {
        return { domain, registrar: "namesilo", expiresAt: "", whoisEmail: "", autoRenew: true, status: "active" };
      }
      return null;
    } catch { return null; }
  }
}
