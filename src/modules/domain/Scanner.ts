import { DomainCandidate } from "../../types";
import { getLogger } from "../../config/logger";
const logger = getLogger();
export class DomainScanner {
  private baseQuery: string;
  constructor(baseQuery: string = "sechat") { this.baseQuery = baseQuery; }
  async scanAvailable(): Promise<DomainCandidate[]> {
    const candidates = this.generateCandidates();
    logger.info("Scanning " + candidates.length + " candidates...");
    const results: DomainCandidate[] = [];
    for (let i = 0; i < candidates.length; i += 5) {
      const batch = candidates.slice(i, i + 5);
      const br = await Promise.allSettled(batch.map(c => this.checkAvailability(c)));
      br.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
      if (i + 5 < candidates.length) await new Promise(r => setTimeout(r, 1000));
    }
    const avail = results.filter(r => r.available);
    avail.sort((a, b) => b.score - a.score);
    logger.info("Found " + avail.length + " available domains");
    return avail;
  }
  private generateCandidates(): DomainCandidate[] {
    const r: DomainCandidate[] = [];
    for (let i = 1; i <= 50; i++) r.push({ domain: this.baseQuery + i + ".com", tld: "com", score: Math.max(100 - i, 60) });
    for (const t of ["io","app","chat"]) r.push({ domain: this.baseQuery + "." + t, tld: t, score: 90 });
    for (const s of ["app","hub","link","talk","meet","one"]) r.push({ domain: this.baseQuery + s + ".com", tld: "com", score: 75 });
    for (const p of ["try","get","use","go"]) r.push({ domain: p + this.baseQuery + ".com", tld: "com", score: 70 });
    return r;
  }
  private async checkAvailability(c: DomainCandidate): Promise<DomainCandidate | null> {
    try {
      const dns = require("dns");
      const avail = await new Promise<boolean>(resolve => dns.resolve4(c.domain, (err: any) => resolve(!!err)));
      return { ...c, available: avail };
    } catch { return c; }
  }
}
