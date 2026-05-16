import { getLogger } from "../../config/logger";
import { StateManager } from "../../engine/StateManager";

const logger = getLogger();

export interface HealthCheckResult {
  module: string
  status: "healthy" | "degraded" | "down"
  latency: number
  lastCheck: number
  error?: string
}

export class HealthMonitor {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private running = false;
  private interval: any = null;
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  registerCheck(name: string, fn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, fn);
  }

  async runAllChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    for (const [name, fn] of this.checks) {
      try {
        const r = await fn();
        this.results.set(name, r);
        results.push(r);
        // Update state manager
        this.stateManager.reportHealth(name, r.status);
        if (r.status !== "healthy") {
          logger.warn("Health: " + name + " is " + r.status + (r.error ? ": " + r.error : ""));
        }
      } catch (err) {
        const failed: HealthCheckResult = {
          module: name, status: "down",
          latency: 0, lastCheck: Date.now(),
          error: String(err),
        };
        this.results.set(name, failed);
        results.push(failed);
        this.stateManager.reportHealth(name, "down");
        logger.error("Health check failed for " + name + ": " + err);
      }
    }
    return results;
  }

  start(intervalMs: number = 300000): void {
    if (this.running) return;
    this.running = true;
    // Run immediately then on interval
    this.runAllChecks();
    this.interval = setInterval(() => this.runAllChecks(), intervalMs);
    logger.info("HealthMonitor started (interval: " + (intervalMs / 1000) + "s)");
  }

  stop(): void {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
  }

  getLastResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  getAllResults(): HealthCheckResult[] {
    return Array.from(this.results.values());
  }
}
