import Stripe from "stripe";
import { getLogger } from "../../config/logger";
import { Database } from "../../database/schema";
import { BotConfig, PaymentRecord } from "../../types";

const logger = getLogger();

/**
 * PaymentProcessor handles Stripe integration:
 * - Creating payment links/checkout sessions for sponsors
 * - Handling Stripe webhook events
 * - Confirming and recording payments
 * - Reconciliation of pending payments
 */
export class PaymentProcessor {
  private stripe: Stripe;
  private config: BotConfig;
  private db: Database;
  private initialized = false;

  constructor(config: BotConfig) {
    this.config = config;
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: "2023-10-16",
      typescript: true,
    });
    this.db = Database.getInstance();
  }

  /**
   * Initialize the payment processor.
   * Verifies the Stripe API key by making a test call.
   */
  async initialize(): Promise<boolean> {
    try {
      // Verify API key by fetching the Stripe account
      const account = await this.stripe.accounts.retrieve();
      logger.info(
        `Stripe initialized: account ${account.id} (${account.business_type ?? "standard"})`
      );
      this.initialized = true;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Stripe initialization failed: ${msg}`);
      this.initialized = false;
      return false;
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  // ─── Checkout / Payment Link Creation ─────────────────────────────────────

  /**
   * Create a Stripe Checkout Session for a sponsor donation.
   *
   * @param amountCents  Amount in USD cents (e.g. 500 = $5.00)
   * @param sponsorUserId  The sechat user ID of the sponsor (optional for anonymous)
   * @param sponsorUsername The sechat username of the sponsor
   * @param metadata  Additional metadata to attach
   * @returns The checkout URL or null on failure
   */
  async createDonationCheckout(
    amountCents: number,
    sponsorUserId?: string,
    sponsorUsername?: string,
    metadata: Record<string, string> = {}
  ): Promise<{ url: string; sessionId: string } | null> {
    if (!this.initialized) {
      logger.error("PaymentProcessor not initialized");
      return null;
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "SeChat Sponsorship Donation",
                description: sponsorUsername
                  ? `Sponsorship from ${sponsorUsername}`
                  : "Anonymous sponsorship donation",
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          ...metadata,
          ...(sponsorUserId ? { sponsor_user_id: sponsorUserId } : {}),
          ...(sponsorUsername ? { sponsor_username: sponsorUsername } : {}),
          source: "sechatbot",
        },
        success_url: `${this.config.sechatServerUrl}/sponsor/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.config.sechatServerUrl}/sponsor/cancel`,
      });

      logger.info(
        `Donation checkout created: ${session.id} ($${(amountCents / 100).toFixed(2)})`
      );

      return {
        url: session.url ?? "",
        sessionId: session.id,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to create donation checkout: ${msg}`);
      return null;
    }
  }

  /**
   * Create a fixed-price payment link for a specific sponsor level.
   * This is a simpler approach — generates a one-time link.
   *
   * @param priceId  Stripe Price ID (from config or predefined)
   * @param sponsorUserId
   * @param sponsorUsername
   */
  async createFixedPriceLink(
    priceId: string,
    sponsorUserId?: string,
    sponsorUsername?: string
  ): Promise<{ url: string; sessionId: string } | null> {
    if (!this.initialized) return null;

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          ...(sponsorUserId ? { sponsor_user_id: sponsorUserId } : {}),
          ...(sponsorUsername ? { sponsor_username: sponsorUsername } : {}),
          source: "sechatbot",
          price_id: priceId,
        },
        success_url: `${this.config.sechatServerUrl}/sponsor/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.config.sechatServerUrl}/sponsor/cancel`,
      });

      return {
        url: session.url ?? "",
        sessionId: session.id,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to create fixed-price link: ${msg}`);
      return null;
    }
  }

  /**
   * Retrieve a checkout session by ID (useful for confirmation page).
   */
  async getSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to retrieve session ${sessionId}: ${msg}`);
      return null;
    }
  }

  // ─── Webhook Handling ─────────────────────────────────────────────────────

  /**
   * Construct a Stripe event from a raw webhook payload.
   * Verifies the signature using the webhook secret.
   *
   * @param rawBody  The raw request body (Buffer or string)
   * @param signature  The Stripe-Signature header value
   * @returns The parsed event, or null if verification fails
   */
  constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string
  ): Stripe.Event | null {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.stripeWebhookSecret
      );
      return event;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Webhook signature verification failed: ${msg}`);
      return null;
    }
  }

  /**
   * Handle a Stripe webhook event.
   * Returns a response object indicating what was processed.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<{
    handled: boolean;
    payment?: PaymentRecord;
  }> {
    logger.info(`Webhook event received: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return await this.handleSessionCompleted(session);
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return await this.handlePaymentSucceeded(paymentIntent);
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return await this.handlePaymentFailed(paymentIntent);
      }

      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
        return { handled: false };
    }
  }

  /**
   * Handle checkout.session.completed — the customer completed the checkout.
   */
  private async handleSessionCompleted(
    session: Stripe.Checkout.Session
  ): Promise<{ handled: boolean; payment?: PaymentRecord }> {
    const paymentIntentId = session.payment_intent as string | undefined;
    if (!paymentIntentId) {
      logger.warn(`Checkout session ${session.id} has no payment intent`);
      return { handled: false };
    }

    const amount = session.amount_total ?? session.amount_subtotal ?? 0;
    const metadata = (session.metadata ?? {}) as Record<string, string>;

    // Check if already recorded
    const existing = this.db.raw
      .prepare("SELECT id FROM payments WHERE stripe_payment_intent_id = ?")
      .get(paymentIntentId);

    if (existing) {
      logger.debug(`Payment already recorded: ${paymentIntentId}`);
      return { handled: true };
    }

    const { nanoid } = require("nanoid");
    const payment: PaymentRecord = {
      id: nanoid(16),
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: session.customer as string | undefined,
      amount,
      currency: session.currency?.toUpperCase() ?? "USD",
      status: "completed",
      sponsorUserId: metadata.sponsor_user_id,
      sponsorUsername: metadata.sponsor_username,
      metadata,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    this.db.raw
      .prepare(
        `INSERT INTO payments
           (id, stripe_payment_intent_id, stripe_customer_id, amount, currency,
            status, sponsor_user_id, sponsor_username, metadata, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`
      )
      .run(
        payment.id,
        payment.stripePaymentIntentId,
        payment.stripeCustomerId ?? null,
        payment.amount,
        payment.currency,
        payment.sponsorUserId ?? null,
        payment.sponsorUsername ?? null,
        JSON.stringify(payment.metadata),
        payment.createdAt,
        payment.completedAt
      );

    logger.info(
      `Payment recorded: ${payment.id} ($${(amount / 100).toFixed(2)})`
    );

    return { handled: true, payment };
  }

  /**
   * Handle payment_intent.succeeded — direct payment confirmation.
   */
  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<{ handled: boolean; payment?: PaymentRecord }> {
    const existing = this.db.raw
      .prepare("SELECT id FROM payments WHERE stripe_payment_intent_id = ?")
      .get(paymentIntent.id);

    if (existing) {
      // Already recorded via checkout.session.completed
      return { handled: true };
    }

    const metadata = (paymentIntent.metadata ?? {}) as Record<string, string>;
    const { nanoid } = require("nanoid");
    const payment: PaymentRecord = {
      id: nanoid(16),
      stripePaymentIntentId: paymentIntent.id,
      stripeCustomerId: paymentIntent.customer as string | undefined,
      amount: paymentIntent.amount_received,
      currency: paymentIntent.currency?.toUpperCase() ?? "USD",
      status: "completed",
      sponsorUserId: metadata.sponsor_user_id,
      sponsorUsername: metadata.sponsor_username,
      metadata,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    this.db.raw
      .prepare(
        `INSERT INTO payments
           (id, stripe_payment_intent_id, stripe_customer_id, amount, currency,
            status, sponsor_user_id, sponsor_username, metadata, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`
      )
      .run(
        payment.id,
        payment.stripePaymentIntentId,
        payment.stripeCustomerId ?? null,
        payment.amount,
        payment.currency,
        payment.sponsorUserId ?? null,
        payment.sponsorUsername ?? null,
        JSON.stringify(payment.metadata),
        payment.createdAt,
        payment.completedAt
      );

    logger.info(
      `Payment recorded (direct): ${payment.id} ($${(paymentIntent.amount_received / 100).toFixed(2)})`
    );

    return { handled: true, payment };
  }

  /**
   * Handle payment_intent.payment_failed.
   */
  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<{ handled: boolean }> {
    const lastError = paymentIntent.last_payment_error?.message ?? "Unknown error";

    // Record the failed payment
    const { nanoid } = require("nanoid");
    this.db.raw
      .prepare(
        `INSERT INTO payments
           (id, stripe_payment_intent_id, amount, currency, status,
            metadata, created_at)
         VALUES (?, ?, ?, ?, 'failed', ?, ?)`
      )
      .run(
        nanoid(16),
        paymentIntent.id,
        paymentIntent.amount,
        paymentIntent.currency?.toUpperCase() ?? "USD",
        JSON.stringify({ error: lastError }),
        Date.now()
      );

    logger.warn(`Payment failed: ${paymentIntent.id} - ${lastError}`);
    return { handled: true };
  }

  // ─── Reconciliation ───────────────────────────────────────────────────────

  /**
   * Reconcile pending payments with Stripe.
   * Called periodically by the scheduler.
   */
  async reconcilePendingPayments(): Promise<number> {
    if (!this.initialized) return 0;

    const pending = this.db.raw
      .prepare(
        "SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at ASC"
      )
      .all() as Array<{
      id: string;
      stripe_payment_intent_id: string;
      amount: number;
      currency: string;
    }>;

    if (pending.length === 0) {
      logger.debug("No pending payments to reconcile");
      return 0;
    }

    logger.info(`Reconciling ${pending.length} pending payments...`);
    let reconciled = 0;

    for (const p of pending) {
      try {
        const intent = await this.stripe.paymentIntents.retrieve(
          p.stripe_payment_intent_id
        );

        if (intent.status === "succeeded") {
          this.db.raw
            .prepare(
              `UPDATE payments SET status = 'completed', completed_at = ? WHERE id = ?`
            )
            .run(Date.now(), p.id);
          reconciled++;
          logger.info(`Reconciled payment ${p.id}: completed`);
        } else if (intent.status === "canceled" || intent.status === "requires_payment_method") {
          this.db.raw
            .prepare(`UPDATE payments SET status = 'failed' WHERE id = ?`)
            .run(p.id);
          reconciled++;
          logger.info(`Reconciled payment ${p.id}: ${intent.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to reconcile payment ${p.id}: ${msg}`);
      }
    }

    return reconciled;
  }

  /**
   * Get total donation stats.
   */
  getDonationStats(): { totalAmount: number; totalCount: number } {
    const row = this.db.raw
      .prepare(
        `SELECT
           COALESCE(SUM(amount), 0) AS total_amount,
           COUNT(*) AS total_count
         FROM payments WHERE status = 'completed'`
      )
      .get() as { total_amount: number; total_count: number };

    return {
      totalAmount: row.total_amount,
      totalCount: row.total_count,
    };
  }
}
