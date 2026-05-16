import { RegistrarAdapter, CheckResult, DomainInfo } from "./RegistrarAdapter";
import { PorkbunAdapter } from "./PorkbunAdapter";
import { CloudflareAdapter } from "./CloudflareAdapter";
import { NameSiloAdapter } from "./NameSiloAdapter";
import { DomainCandidate } from "../../types";
import { getLogger } from "../../config/logger";

const logger = getLogger();

export class DomainManager {
  private adapters: RegistrarAdapter[] = [];
  private primary: RegistrarAdapter | null = null;
  private secondary: RegistrarAdapter | null = null;
  private initialized = false;

  async initialize(): Promise<boolean> {
    const config = (await import("../../config/index")).loadConfig();
    const available: RegistrarAdapter[] = [];

    // Try Porkbun first
    if (config.porkbunApiKey && config.porkbunSecretKey) {
      const p = new PorkbunAdapter(config.porkbunApiKey, config.porkbunSecretKey);
      if (await p.testConnection()) available.push(p);
    }

    // Try Cloudflare
    if (config.cloudflareApiToken) {
      const c = new CloudflareAdapter(config.cloudflareApiToken);
      if (await c.testConnection()) available.push(c);
    }

    // Try NameSilo
    if (config.namesiloApiKey) {
      const n = new NameSiloAdapter(config.namesiloApiKey);
      if (await n.testConnection()) available.push(n);
    }

    // Sort by priority (lower = better)
    available.sort((a, b) => a.priority - b.priority);

    if (available.length >= 2) {
      this.primary = available[0];
      this.secondary = available[1];
      logger.info("Domain registrars: " + this.primary.name + " (primary), " + this.secondary.name + " (secondary)");
      this.initialized = true;
    } else if (available.length === 1) {
      this.primary = available[0];
      logger.warn("Only one registrar available: " + this.primary.name + ". Cross-registrar strategy disabled.");
      this.initialized = true;
    } else {
      logger.warn("No domain registrars configured");
    }

    return this.initialized;
  }

  async discoverDomains(): Promise<DomainCandidate[]> {
    if (!this.primary) return [];
    const scanner = new (await import("./Scanner")).DomainScanner("sechat");
    return await scanner.scanAvailable();
  }

  async executeFullStrategy(): Promise<{ domainA: string; domainB: string; regA: string; regB: string } | null> {
    if (!this.primary || !this.secondary) {
      logger.error("Need 2 registrars for cross-registrar strategy");
      return null;
    }

    const available = await this.discoverDomains();
    if (available.length < 2) return null;

    const best = available[0];
    const second = available[1];

    // Register A on primary registrar with B's email
    const emailB = "admin@" + second.domain;
    const okA = await this.primary.registerDomain(best.domain, 1, emailB);
    if (!okA) {
      logger.error("Failed to register " + best.domain + " on " + this.primary.name);
      return null;
    }

    // Register B on secondary registrar with A's email
    const emailA = "admin@" + best.domain;
    const okB = await this.secondary.registerDomain(second.domain, 1, emailA);
    if (!okB) {
      logger.warn("Secondary registration may have failed");
    }

    logger.info("DomainA: " + best.domain + " (" + this.primary.name + ") -> WHOIS: " + emailB);
    logger.info("DomainB: " + second.domain + " (" + this.secondary.name + ") -> WHOIS: " + emailA);

    return {
      domainA: best.domain,
      domainB: second.domain,
      regA: this.primary.name,
      regB: this.secondary.name,
    };
  }

  getPrimary(): RegistrarAdapter | null { return this.primary; }
  getSecondary(): RegistrarAdapter | null { return this.secondary; }
  isReady(): boolean { return this.initialized; }
}
