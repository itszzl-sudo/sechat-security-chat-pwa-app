import axios from "axios";
import { RegistrarAdapter, CheckResult, DomainInfo } from "./RegistrarAdapter";
import { DNSRecord } from "../../types";
import { getLogger } from "../../config/logger";

const logger = getLogger();

export class PorkbunAdapter implements RegistrarAdapter {
  readonly name = "porkbun"
  readonly priority = 0 // Highest priority
  private baseUrl = "https://api.porkbun.com/api/json/v3"

  constructor(
    private apiKey: string,
    private secretKey: string
  ) {}

  async testConnection(): Promise<boolean> {
    try {
      const r = await axios.post(this.baseUrl + "/ping", {
        apikey: this.apiKey,
        secretapikey: this.secretKey,
      });
      return r.data?.status === "SUCCESS";
    } catch {
      return false;
    }
  }

  async checkDomain(domain: string): Promise<CheckResult> {
    try {
      const r = await axios.post(this.baseUrl + "/domain/check/" + domain, {
        apikey: this.apiKey,
        secretapikey: this.secretKey,
      });
      return {
        available: r.data?.status === "AVAILABLE",
        price: r.data?.price,
      };
    } catch (err) {
      logger.warn("Porkbun check failed: " + err);
      return { available: false };
    }
  }

  async registerDomain(domain: string, years: number = 1, whoisEmail: string): Promise<boolean> {
    try {
      const r = await axios.post(this.baseUrl + "/domain/register/" + domain, {
        apikey: this.apiKey,
        secretapikey: this.secretKey,
        years: years,
        whois: { email: whoisEmail },
        privacy: 1,
        auto_renew: 1,
      });
      const ok = r.data?.status === "SUCCESS";
      logger.info("Porkbun register " + domain + ": " + (ok ? "OK" : "FAIL"));
      return ok;
    } catch (err) {
      logger.error("Porkbun register failed: " + err);
      return false;
    }
  }

  async setWhoisEmail(domain: string, email: string): Promise<boolean> {
    try {
      const r = await axios.post(this.baseUrl + "/domain/update/" + domain, {
        apikey: this.apiKey,
        secretapikey: this.secretKey,
        whois: { email: email },
      });
      return r.data?.status === "SUCCESS";
    } catch {
      return false;
    }
  }

  async setDNSRecords(domain: string, records: DNSRecord[]): Promise<boolean> {
    try {
      for (const rec of records) {
        await axios.post(this.baseUrl + "/dns/create/" + domain, {
          apikey: this.apiKey,
          secretapikey: this.secretKey,
          name: rec.name,
          type: rec.type,
          content: rec.content,
          ttl: rec.ttl || 600,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  async enableAutoRenew(domain: string, enabled: boolean): Promise<boolean> {
    try {
      await axios.post(this.baseUrl + "/domain/update/" + domain, {
        apikey: this.apiKey,
        secretapikey: this.secretKey,
        auto_renew: enabled ? "1" : "0",
      });
      return true;
    } catch {
      return false;
    }
  }

  async getDomainInfo(domain: string): Promise<DomainInfo | null> {
    try {
      const r = await axios.post(this.baseUrl + "/domain/check/" + domain, {
        apikey: this.apiKey,
        secretapikey: this.secretKey,
      });
      if (r.data?.status === "SUCCESS") {
        return {
          domain,
          registrar: "porkbun",
          expiresAt: r.data?.expires || "",
          whoisEmail: r.data?.whois?.email || "",
          autoRenew: r.data?.auto_renew === "1",
          status: "active",
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
