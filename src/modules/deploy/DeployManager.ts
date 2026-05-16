import { DigitalOceanAdapter } from "./DigitalOceanAdapter";
import { SSHClient } from "./SSHClient";
import { DockerManager } from "./DockerManager";
import { VPSInstance } from "../../types";
import { getLogger } from "../../config/logger";
const logger = getLogger();
export class DeployManager {
  private doAdapter: DigitalOceanAdapter | null = null;
  private initialized = false;
  async initialize(): Promise<boolean> {
    const config = (await import("../../config/index")).loadConfig();
    if (config.digitaloceanPat) this.doAdapter = new DigitalOceanAdapter(config.digitaloceanPat);
    this.initialized = !!this.doAdapter;
    logger.info("DeployManager: " + (this.initialized ? "READY" : "No DO token"));
    return this.initialized;
  }
  async createVPS(name: string): Promise<VPSInstance | null> {
    if (!this.doAdapter) return null;
    const vps = await this.doAdapter.createDroplet(name);
    if (!vps) return null;
    return (await this.doAdapter.waitForDroplet(vps.id)) ? vps : null;
  }
  async setupDocker(vps: VPSInstance): Promise<boolean> {
    const ssh = new SSHClient(vps.ip);
    if (!await ssh.testConnection()) return false;
    return await new DockerManager(ssh).installDocker();
  }
  async deployApp(vps: VPSInstance, repo: string, branch: string, name: string): Promise<boolean> {
    const ssh = new SSHClient(vps.ip);
    const cmds = [
      "apt-get update && apt-get install -y git",
      "mkdir -p /app && cd /app && git clone -b " + branch + " https://github.com/" + repo + ".git " + name,
      "cd /app/" + name + " && npm install",
      "cd /app/" + name + " && npm run build || true",
      "cd /app/" + name + " && nohup node dist/index.js > /var/log/" + name + ".log 2>&1 &",
    ];
    for (const cmd of cmds) {
      const r = await ssh.exec(cmd);
      if (r.exitCode !== 0) logger.warn("Exit " + r.exitCode + ": " + cmd.substring(0, 50));
    }
    // Check if process is running
    const check = await ssh.exec("pgrep -f " + name + " | head -1");
    const ok = check.exitCode === 0;
    logger.info("Deploy " + name + ": " + (ok ? "OK" : "FAILED"));
    return ok;
  }
  isReady(): boolean { return this.initialized; }
}