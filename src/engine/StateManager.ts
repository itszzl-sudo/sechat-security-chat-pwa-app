import { getLogger } from "../config/logger";
import { Database } from "../database/schema";
import {
  DeploymentState,
  ModuleHealth,
  TaskLog,
  SettingRecord,
} from "../types";

const logger = getLogger();

/**
 * StateManager tracks deployment state, module health, and task history.
 * All state is persisted in SQLite.
 */
export class StateManager {
  private db: Database;
  private moduleHealthCache: Map<string, ModuleHealth> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.db = Database.getInstance();
  }

  // ─── Deployment State ──────────────────────────────────────────────────────

  /**
   * Get the current deployment state. Returns defaults if not yet set.
   */
  getDeploymentState(): DeploymentState {
    const row = this.db.raw
      .prepare("SELECT * FROM deployment_state WHERE key = 'deployment'")
      .get() as
      | {
          phase: string;
          step: string;
          started_at: number | null;
          completed_at: number | null;
          error: string | null;
          metadata: string;
        }
      | undefined;

    if (!row) {
      return {
        phase: "none",
        step: "initial",
        metadata: {},
      };
    }

    return {
      phase: row.phase as DeploymentState["phase"],
      step: row.step,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      error: row.error ?? undefined,
      metadata: this.parseJsonSafe<Record<string, string>>(row.metadata, {}),
    };
  }

  /**
   * Update the deployment phase and step.
   */
  updateDeployment(
    phase: DeploymentState["phase"],
    step: string,
    metadata?: Record<string, string>
  ): void {
    const now = Date.now();
    const existing = this.db.raw
      .prepare("SELECT * FROM deployment_state WHERE key = 'deployment'")
      .get() as { started_at: number | null } | undefined;

    const startedAt = existing?.started_at ?? now;
    const metaStr = metadata ? JSON.stringify(metadata) : "{}";

    this.db.raw
      .prepare(
        `UPDATE deployment_state SET
           phase = ?, step = ?, started_at = ?, completed_at = NULL,
           error = NULL, metadata = ?, updated_at = ?
         WHERE key = 'deployment'`
      )
      .run(phase, step, startedAt, metaStr, now);

    logger.info(`Deployment state updated: phase=${phase}, step=${step}`);
  }

  /**
   * Mark deployment as completed with the given phase.
   */
  completeDeployment(phase: DeploymentState["phase"]): void {
    const now = Date.now();
    this.db.raw
      .prepare(
        `UPDATE deployment_state SET
           phase = ?, completed_at = ?, error = NULL, updated_at = ?
         WHERE key = 'deployment'`
      )
      .run(phase, now, now);

    logger.info(`Deployment completed: phase=${phase}`);
  }

  /**
   * Mark deployment as failed with an error.
   */
  failDeployment(phase: DeploymentState["phase"], step: string, error: string): void {
    const now = Date.now();
    this.db.raw
      .prepare(
        `UPDATE deployment_state SET
           phase = ?, step = ?, error = ?, updated_at = ?
         WHERE key = 'deployment'`
      )
      .run(phase, step, error, now);

    logger.error(`Deployment failed: phase=${phase}, step=${step}, error=${error}`);
  }

  // ─── Module Health ─────────────────────────────────────────────────────────

  /**
   * Register a module for health tracking.
   */
  registerModule(moduleName: string): void {
    const existing = this.db.raw
      .prepare("SELECT module_name FROM module_health WHERE module_name = ?")
      .get(moduleName);

    if (!existing) {
      this.db.raw
        .prepare(
          `INSERT INTO module_health (module_name, status, last_check_at, uptime_ms, metadata)
           VALUES (?, 'healthy', unixepoch(), 0, '{}')`
        )
        .run(moduleName);
      logger.info(`Module registered for health tracking: ${moduleName}`);
    }
  }

  /**
   * Report module health status.
   */
  reportHealth(moduleName: string, status: ModuleHealth["status"], error?: string): void {
    const now = Date.now();
    const existing = this.db.raw
      .prepare("SELECT uptime_ms, last_check_at FROM module_health WHERE module_name = ?")
      .get(moduleName) as { uptime_ms: number; last_check_at: number } | undefined;

    let uptimeMs = 0;
    if (existing) {
      // If status is healthy, accumulate uptime
      if (status === "healthy") {
        const elapsed = now - existing.last_check_at * 1000;
        uptimeMs = existing.uptime_ms + Math.max(0, elapsed);
      } else {
        uptimeMs = existing.uptime_ms;
      }
    }

    this.db.raw
      .prepare(
        `UPDATE module_health SET
           status = ?, last_check_at = ?, last_error = ?,
           uptime_ms = ?, updated_at = unixepoch()
         WHERE module_name = ?`
      )
      .run(status, Math.floor(now / 1000), error ?? null, uptimeMs, moduleName);

    // Update cache
    const health: ModuleHealth = {
      moduleName,
      status,
      lastCheckAt: now,
      lastError: error,
      uptimeMs,
      metadata: {},
    };
    this.moduleHealthCache.set(moduleName, health);

    if (status !== "healthy") {
      logger.warn(`Module health degraded: ${moduleName} -> ${status}${error ? `: ${error}` : ""}`);
    }
  }

  /**
   * Get health status for all modules.
   */
  getAllHealth(): ModuleHealth[] {
    const rows = this.db.raw
      .prepare("SELECT * FROM module_health")
      .all() as Array<{
      module_name: string;
      status: string;
      last_check_at: number;
      last_error: string | null;
      uptime_ms: number;
      metadata: string;
    }>;

    return rows.map((r) => ({
      moduleName: r.module_name,
      status: r.status as ModuleHealth["status"],
      lastCheckAt: r.last_check_at * 1000,
      lastError: r.last_error ?? undefined,
      uptimeMs: r.uptime_ms,
      metadata: this.parseJsonSafe<Record<string, unknown>>(r.metadata, {}),
    }));
  }

  /**
   * Get health for a specific module.
   */
  getModuleHealth(moduleName: string): ModuleHealth | null {
    const cached = this.moduleHealthCache.get(moduleName);
    if (cached) return cached;

    const row = this.db.raw
      .prepare("SELECT * FROM module_health WHERE module_name = ?")
      .get(moduleName) as
      | {
          module_name: string;
          status: string;
          last_check_at: number;
          last_error: string | null;
          uptime_ms: number;
          metadata: string;
        }
      | undefined;

    if (!row) return null;

    return {
      moduleName: row.module_name,
      status: row.status as ModuleHealth["status"],
      lastCheckAt: row.last_check_at * 1000,
      lastError: row.last_error ?? undefined,
      uptimeMs: row.uptime_ms,
      metadata: this.parseJsonSafe<Record<string, unknown>>(row.metadata, {}),
    };
  }

  /**
   * Start periodic health check logging (every 60s).
   */
  startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      const allHealth = this.getAllHealth();
      const unhealthy = allHealth.filter((h) => h.status !== "healthy");
      if (unhealthy.length > 0) {
        logger.warn(
          `Health check: ${unhealthy.length}/${allHealth.length} modules degraded`,
          { unhealthy: unhealthy.map((h) => h.moduleName) }
        );
      } else {
        logger.debug(`Health check: all ${allHealth.length} modules healthy`);
      }
    }, 60_000);
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ─── Task Logging ──────────────────────────────────────────────────────────

  /**
   * Start a new task log entry. Returns the task ID.
   */
  startTask(taskName: string): string {
    const { nanoid } = require("nanoid");
    const id = nanoid(12);
    const now = Date.now();

    this.db.raw
      .prepare(
        `INSERT INTO task_logs (id, task_name, status, started_at)
         VALUES (?, ?, 'running', ?)`
      )
      .run(id, taskName, now);

    logger.debug(`Task started: ${taskName} (${id})`);
    return id;
  }

  /**
   * Complete a task as successful.
   */
  completeTask(taskId: string, details?: string): void {
    const now = Date.now();
    const task = this.db.raw
      .prepare("SELECT started_at FROM task_logs WHERE id = ?")
      .get(taskId) as { started_at: number } | undefined;

    if (!task) {
      logger.warn(`Attempted to complete unknown task: ${taskId}`);
      return;
    }

    const durationMs = now - task.started_at;

    this.db.raw
      .prepare(
        `UPDATE task_logs SET
           status = 'success', completed_at = ?, duration_ms = ?, details = ?
         WHERE id = ?`
      )
      .run(now, durationMs, details ?? null, taskId);

    logger.debug(`Task completed: ${taskId} (${durationMs}ms)`);
  }

  /**
   * Fail a task with an error.
   */
  failTask(taskId: string, error: string): void {
    const now = Date.now();
    const task = this.db.raw
      .prepare("SELECT started_at FROM task_logs WHERE id = ?")
      .get(taskId) as { started_at: number } | undefined;

    const durationMs = task ? now - task.started_at : 0;

    this.db.raw
      .prepare(
        `UPDATE task_logs SET
           status = 'failure', completed_at = ?, duration_ms = ?, error = ?
         WHERE id = ?`
      )
      .run(now, durationMs, error, taskId);

    logger.error(`Task failed: ${taskId} (${durationMs}ms): ${error}`);
  }

  /**
   * Get recent task logs.
   */
  getRecentTasks(limit = 20): TaskLog[] {
    const rows = this.db.raw
      .prepare(
        "SELECT * FROM task_logs ORDER BY started_at DESC LIMIT ?"
      )
      .all(limit) as Array<{
      id: string;
      task_name: string;
      status: string;
      started_at: number;
      completed_at: number | null;
      duration_ms: number | null;
      error: string | null;
      details: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      taskName: r.task_name,
      status: r.status as TaskLog["status"],
      startedAt: r.started_at,
      completedAt: r.completed_at ?? undefined,
      durationMs: r.duration_ms ?? undefined,
      error: r.error ?? undefined,
      details: r.details ?? undefined,
    }));
  }

  // ─── Settings (key-value store) ────────────────────────────────────────────

  getSetting(key: string): string | undefined {
    const row = this.db.raw
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.raw
      .prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`
      )
      .run(key, value);
    logger.debug(`Setting updated: ${key}=${value}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private parseJsonSafe<T>(raw: string, fallback: T): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}
