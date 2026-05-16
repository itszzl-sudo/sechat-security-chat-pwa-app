import axios from "axios";
import { VPSInstance } from "../../types";
import { getLogger } from "../../config/logger";
const logger = getLogger();
export class DigitalOceanAdapter {
  private pat: string;
  private baseUrl = "https://api.digitalocean.com/v2";
  constructor(pat: string) { this.pat = pat; }
  private get h() { return { Authorization: "Bearer " + this.pat, "Content-Type": "application/json" }; }
  async createDroplet(name: string, region = "sgp1", size = "s-1vcpu-1gb"): Promise<VPSInstance | null> {
    try {
      const r = await axios.post(this.baseUrl + "/droplets", {name, region, size, image: "ubuntu-22-04-x64", tags: ["sechatbot","sechat"], monitoring: true}, { headers: this.h, timeout: 30000 });
      const d = r.data?.droplet;
      if (!d) return null;
      return { id: String(d.id), name: d.name, ip: d.networks?.v4?.[0]?.ip_address || "", region: d.region?.slug || region, size: d.size_slug || size, status: "new", createdAt: Date.now() };
    } catch (err) { logger.error("DO create failed: " + err); return null; }
  }
  async waitForDroplet(id: string, timeoutMs = 180000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try { const r = await axios.get(this.baseUrl + "/droplets/" + id, { headers: this.h, timeout: 15000 }); if (r.data?.droplet?.status === "active") return true; } catch {}
      await new Promise(r => setTimeout(r, 10000));
    }
    return false;
  }
  async deleteDroplet(id: string): Promise<boolean> {
    try { await axios.delete(this.baseUrl + "/droplets/" + id, { headers: this.h, timeout: 30000 }); return true; } catch { return false; }
  }
}