import { SSHClient } from "./SSHClient";
import { getLogger } from "../../config/logger";
const logger = getLogger();

export class DockerManager {
  constructor(private ssh: SSHClient) {}

  async installDocker(): Promise<boolean> {
    const cmds = [
      "curl -fsSL https://get.docker.com | sh",
      "systemctl enable docker",
      "systemctl start docker",
    ];
    for (const cmd of cmds) {
      const r = await this.ssh.exec(cmd);
      if (r.exitCode !== 0) logger.warn("Docker step: exit " + r.exitCode);
    }
    const v = await this.ssh.exec("docker --version");
    logger.info("Docker: " + (v.exitCode === 0 ? "INSTALLED" : "FAILED"));
    return v.exitCode === 0;
  }

  async deployCompose(name: string, compose: string): Promise<boolean> {
    // Write compose file via SSH
    const w = await this.ssh.exec("echo '" + compose + "' > /root/docker-compose.yml");
    if (w.exitCode !== 0) return false;
    const r = await this.ssh.exec("cd /root && docker-compose up -d");
    logger.info("Compose " + name + ": " + (r.exitCode === 0 ? "UP" : "FAILED"));
    return r.exitCode === 0;
  }

  async checkHealth(name: string): Promise<boolean> {
    const r = await this.ssh.exec("docker ps --filter name=" + name + " --format '{{.Status}}'");
    return r.stdout.includes("Up");
  }
}
