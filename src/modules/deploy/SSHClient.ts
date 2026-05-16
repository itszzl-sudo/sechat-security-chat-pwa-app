import { CommandResult } from "../../types";
import { getLogger } from "../../config/logger";
const logger = getLogger();
export class SSHClient {
  constructor(private host: string, private port: number = 22, private username: string = "root", private privateKey: string = "") {}
  async exec(cmd: string): Promise<CommandResult> {
    const start = Date.now();
    try {
      const { exec } = require("child_process");
      const ssh = "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10" + (this.privateKey ? " -i " + this.privateKey : "") + " -p " + this.port + " " + this.username + "@" + this.host + " " + JSON.stringify(cmd);
      return await new Promise(resolve => { exec(ssh, { timeout: 60000 }, (err: any, stdout: string, stderr: string) => resolve({ stdout: stdout || "", stderr: stderr || "", exitCode: err ? (err.code || 1) : 0, duration: Date.now() - start })); });
    } catch (err) { return { stdout: "", stderr: String(err), exitCode: 1, duration: Date.now() - start }; }
  }
  async testConnection(): Promise<boolean> { const r = await this.exec("echo OK"); return r.stdout.includes("OK"); }
}