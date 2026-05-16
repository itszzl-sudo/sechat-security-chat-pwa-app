import axios from "axios";
import { RegistrarAdapter, CheckResult, DomainInfo } from "./RegistrarAdapter";
import { DNSRecord } from "../../types";
import { getLogger } from "../../config/logger";

const logger = getLogger();

export class CloudflareAdapter implements RegistrarAdapter {
  readonly name = "cloudflare"
  readonly priority = 1
  private apiToken: string;
  private baseUrl = "https://api.cloudflare.com/client/v4";

  constructor(apiToken: string) { this.apiToken = apiToken; }

  private get headers() {
    return { Authorization: "Bearer " + this.apiToken, "Content-Type": "application/json" };
  }

  async testConnection(): Promise<boolean> {
    try {
      const r = await axios.get(this.baseUrl + "/user/tokens/verify", { headers: this.headers, timeout: 15000 });
      return r.data?.success === true;
    } catch { return false; }
  }

  async checkDomain(domain: string): Promise<CheckResult> {
    try {
      const r = await axios.post(this.baseUrl + "/accounts/-/registrar/domains/check", [{domain}], { headers: this.headers, timeout: 15000 });
      const result = r.data?.result?.[0];
      return { available: result?.available === true };
    } catch { return { available: false }; }
  }

  async registerDomain(domain: string, years: number = 1, whoisEmail: string): Promise<boolean> {
    try {
      const r = await axios.post(this.baseUrl + "/accounts/-/registrar/domains", { domain, years, privacy: true, auto_renew: true }, { headers: this.headers, timeout: 30000 });
      return r.data?.success === true;
    } catch (err) { logger.error("CF register failed: " + err); return false; }
  }

  async setWhoisEmail(domain: string, email: string): Promise<boolean> {
    try {
      const r = await axios.patch(this.baseUrl + "/accounts/-/registrar/domains/" + domain, { contact: { email } }, { headers: this.headers, timeout: 15000 });
      return r.data?.success === true;
    } catch { return false; }
  }

  async setDNSRecords(domain: string, records: DNSRecord[]): Promise<boolean> {
    try {
      const zoneResp = await axios.get(this.baseUrl + "/zones?name=" + domain, { headers: this.headers, timeout: 15000 });
      const zoneId = zoneResp.data?.result?.[0]?.id;
      if (!zoneId) return false;
      for (const rec of records) {
        await axios.post(this.baseUrl + "/zones/" + zoneId + "/dns_records", { type: rec.type, name: rec.name, content: rec.content, ttl: rec.ttl || 120, proxied: false }, { headers: this.headers, timeout: 15000 });
      }
      return true;
    } catch { return false; }
  }

  async enableAutoRenew(domain: string, enabled: boolean): Promise<boolean> {
    try {
      const r = await axios.patch(this.baseUrl + "/accounts/-/registrar/domains/" + domain, { auto_renew: enabled }, { headers: this.headers, timeout: 15000 });
      return r.data?.success === true;
    } catch { return false; }
  }

  async getDomainInfo(domain: string): Promise<DomainInfo | null> {
    try {
      const r = await axios.get(this.baseUrl + "/accounts/-/registrar/domains/" + domain, { headers: this.headers, timeout: 15000 });
      const d = r.data?.result;
      if (!d) return null;
      return { domain, registrar: "cloudflare", expiresAt: d.expires_at || "", whoisEmail: d.contact?.email || "", autoRenew: d.auto_renew || false, status: d.status || "active" };
    } catch { return null; }
  }
}
