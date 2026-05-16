import cron from "node-cron";
import { EventEmitter } from "events";
import { getLogger } from "../config/logger";
import { StateManager } from "./StateManager";

const logger = getLogger();

/**
 * Task function type — scheduled or event-driven.
 */
export type TaskHandler = (context: TaskContext) => Promise<void>;

export interface TaskContext {
  taskId: string;
  taskName: string;
  scheduledTime?: Date;
  payload?: Record<string, unknown>;
}

export interface ScheduledTask {
  name: string;
  cronExpression: string;
  handler: TaskHandler;
  enabled: boolean;
}

export interface WebhookHandler {
  event: string;
  handler: (payload: Record<string, unknown>) => Promise<void>;
}

/**
 * Scheduler manages cron-based recurring tasks and event-driven webhook handlers.
 * It also provides lifecycle management (start/stop) for all registered tasks.
 */
export class Scheduler {
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private webhookHandlers: Map<string, WebhookHandler[]> = new Map();
  private eventBus: EventEmitter = new EventEmitter();
  private stateManager: StateManager;
  private running = false;

  // Default scheduled tasks
  private defaultTasks: ScheduledTask[] = [
    {
      name: "health_check",
      cronExpression: "*/5 * * * *", // every 5 minutes
      handler: async (ctx) => {
        const allHealth = this.stateManager.getAllHealth();
        const unhealthy = allHealth.filter((h) => h.status !== "healthy");
        if (unhealthy.length > 0) {
          logger.warn(
            `Scheduled health check: ${unhealthy.length}/${allHealth.length} modules unhealthy`,
            { unhealthy: unhealthy.map((h) => h.moduleName) }
          );
        }
      },
      enabled: true,
    },
    {
      name: "payment_reconciliation",
      cronExpression: "0 */6 * * *", // every 6 hours
      handler: async (ctx) => {
        logger.info("Running payment reconciliation task");
        // PaymentProcessor reconciliation will be wired in at boot
        this.eventBus.emit("task:payment_reconciliation", ctx);
      },
      enabled: true,
    },
    {
      name: "sponsor_role_sync",
      cronExpression: "0 */2 * * *", // every 2 hours
      handler: async (ctx) => {
        logger.info("Running sponsor role sync task");
        this.eventBus.emit("task:sponsor_role_sync", ctx);
      },
      enabled: true,
    },
    {
      name: "sponsor_cleanup",
      cronExpression: "0 0 * * 0", // weekly on Sunday midnight
      handler: async (ctx) => {
        logger.info("Running weekly sponsor cleanup task");
        this.eventBus.emit("task:sponsor_cleanup", ctx);
      },
      enabled: true,
    },
    // ── Phase 3: Operational Autonomy Tasks ─────────────────────────────
    {
      name: "fund_check",
      cronExpression: "0 * * * *", // every hour
      handler: async (ctx) => {
        logger.info("Running fund check");
        this.eventBus.emit("task:fund_check", ctx);
      },
      enabled: true,
    },
    {
      name: "domain_renewal_check",
      cronExpression: "0 0 * * 1", // weekly on Monday
      handler: async (ctx) => {
        logger.info("Running domain renewal check");
        this.eventBus.emit("task:domain_renewal_check", ctx);
      },
      enabled: true,
    },
    {
      name: "self_update_check",
      cronExpression: "0 */12 * * *", // every 12 hours
      handler: async (ctx) => {
        logger.info("Running self-update check");
        this.eventBus.emit("task:self_update_check", ctx);
      },
      enabled: true,
    },
    {
      name: "deployment_health",
      cronExpression: "*/10 * * * *", // every 10 minutes
      handler: async (ctx) => {
        logger.info("Running deployment health check");
        this.eventBus.emit("task:deployment_health", ctx);
      },
      enabled: true,
    },
    {
      name: "proposal_tally",
      cronExpression: "0 * * * *", // every hour
      handler: async (ctx) => {
        logger.info("Checking expired upgrade proposals");
        this.eventBus.emit("task:proposal_tally", ctx);
      },
      enabled: true,
    },
  ];

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  // ─── Cron Task Management ──────────────────────────────────────────────────

  /**
   * Register a cron-scheduled task.
   */
  registerTask(task: ScheduledTask): void {
    if (this.cronJobs.has(task.name)) {
      logger.warn(`Task already registered, overwriting: ${task.name}`);
      this.removeTask(task.name);
    }
    this.defaultTasks.push(task);
    if (this.running && task.enabled) {
      this.startTask(task);
    }
    logger.info(`Task registered: ${task.name} [${task.cronExpression}]`);
  }

  /**
   * Remove a previously registered task.
   */
  removeTask(name: string): void {
    const job = this.cronJobs.get(name);
    if (job) {
      job.stop();
      this.cronJobs.delete(name);
    }
    const idx = this.defaultTasks.findIndex((t) => t.name === name);
    if (idx >= 0) {
      this.defaultTasks.splice(idx, 1);
    }
  }

  /**
   * Enable or disable a task.
   */
  setTaskEnabled(name: string, enabled: boolean): void {
    const task = this.defaultTasks.find((t) => t.name === name);
    if (!task) {
      logger.warn(`Task not found: ${name}`);
      return;
    }
    task.enabled = enabled;
    if (enabled && this.running) {
      this.startTask(task);
    } else {
      const job = this.cronJobs.get(name);
      if (job) {
        job.stop();
        this.cronJobs.delete(name);
      }
    }
    logger.info(`Task ${enabled ? "enabled" : "disabled"}: ${name}`);
  }

  // ─── Webhook / Event Handlers ──────────────────────────────────────────────

  /**
   * Register an event-driven handler.
   */
  onWebhookEvent(event: string, handler: WebhookHandler["handler"]): void {
    if (!this.webhookHandlers.has(event)) {
      this.webhookHandlers.set(event, []);
    }
    this.webhookHandlers.get(event)!.push({ event, handler });
    logger.info(`Webhook handler registered for event: ${event}`);
  }

  /**
   * Emit a webhook event, invoking all registered handlers.
   */
  async emitEvent(event: string, payload: Record<string, unknown>): Promise<void> {
    const handlers = this.webhookHandlers.get(event);
    if (!handlers || handlers.length === 0) {
      logger.debug(`No handlers for event: ${event}`);
      return;
    }

    logger.info(`Emitting event: ${event} (${handlers.length} handlers)`);
    const results = await Promise.allSettled(
      handlers.map((h) => h.handler(payload))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        logger.error(
          `Webhook handler failed for event ${event}: ${result.reason}`
        );
      }
    }
  }

  /**
   * Emit an internal event on the event bus (for task-to-task communication).
   */
  emitInternal(event: string, data: unknown): void {
    this.eventBus.emit(event, data);
  }

  /**
   * Listen for internal events.
   */
  onInternal(event: string, listener: (...args: unknown[]) => void): void {
    this.eventBus.on(event, listener);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the scheduler — activates all enabled cron tasks.
   */
  start(): void {
    if (this.running) {
      logger.warn("Scheduler is already running");
      return;
    }

    logger.info("Starting scheduler...");
    this.running = true;

    for (const task of this.defaultTasks) {
      if (task.enabled) {
        this.startTask(task);
      }
    }

    logger.info(
      `Scheduler started with ${this.cronJobs.size} cron tasks and ${this.webhookHandlers.size} event types`
    );
  }

  /**
   * Stop the scheduler — deactivates all cron tasks.
   */
  stop(): void {
    if (!this.running) return;

    logger.info("Stopping scheduler...");
    for (const [name, job] of this.cronJobs) {
      job.stop();
      logger.debug(`Cron task stopped: ${name}`);
    }
    this.cronJobs.clear();
    this.running = false;
    logger.info("Scheduler stopped");
  }

  /**
   * Get a list of all registered task names and their status.
   */
  getTaskStatus(): Array<{ name: string; enabled: boolean; running: boolean }> {
    return this.defaultTasks.map((t) => ({
      name: t.name,
      enabled: t.enabled,
      running: this.cronJobs.has(t.name),
    }));
  }

  /**
   * Get list of registered webhook event types.
   */
  getWebhookEvents(): string[] {
    return Array.from(this.webhookHandlers.keys());
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private startTask(task: ScheduledTask): void {
    if (!cron.validate(task.cronExpression)) {
      logger.error(`Invalid cron expression for task "${task.name}": ${task.cronExpression}`);
      return;
    }

    const job = cron.schedule(
      task.cronExpression,
      async () => {
        const taskId = this.stateManager.startTask(task.name);
        const context: TaskContext = {
          taskId,
          taskName: task.name,
          scheduledTime: new Date(),
        };

        try {
          await task.handler(context);
          this.stateManager.completeTask(taskId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.stateManager.failTask(taskId, message);
          logger.error(`Task "${task.name}" failed: ${message}`);
        }
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    this.cronJobs.set(task.name, job);
    logger.debug(`Cron task scheduled: ${task.name} [${task.cronExpression}]`);
  }
}
