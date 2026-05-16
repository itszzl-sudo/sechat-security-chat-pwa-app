import { getLogger } from "../../config/logger";

const logger = getLogger();

export interface FundState {
  stripeTotal: number
  usdtBalance: number
  totalBalance: number          // stripe + usdt
  reservedForOps: number        // $50 minimum reserve
  availableForRepayment: number
  startupLoanRemaining: number
  funderAddress: string | null
  lastUpdated: number
}

export class FundManager {
  private initialized = false;
  private loanAmount = 100;     // $100 startup loan
  private reserveAmount = 50;   // $50 ops reserve

  async initialize(): Promise<boolean> {
    this.initialized = true;
    logger.info("FundManager initialized (loan=" + this.loanAmount + " reserve=" + this.reserveAmount + ")");
    return true;
  }

  async checkFunds(usdtBalance: number = 0): Promise<FundState> {
    const db = (await import("../../database/schema")).Database.getInstance();

    // Stripe donations
    const stripeRow = db.raw.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed' AND currency = 'usd'"
    ).get() as any;
    const stripeTotal = stripeRow?.total || 0;

    // Startup loan
    const loanRow = db.raw.prepare(
      "SELECT COALESCE(remaining, 0) as remaining FROM startup_loans WHERE status = 'active' LIMIT 1"
    ).get() as any;
    const startupLoanRemaining = loanRow?.remaining || this.loanAmount;

    // Funder address
    const funderRow = db.raw.prepare(
      "SELECT value FROM settings WHERE key = 'funder_usdt_address'"
    ).get() as any;
    const funderAddress = funderRow?.value || null;

    const totalBalance = stripeTotal + usdtBalance;
    const availableForRepayment = Math.max(0, totalBalance - this.reserveAmount);

    const state: FundState = {
      stripeTotal, usdtBalance, totalBalance,
      reservedForOps: this.reserveAmount,
      availableForRepayment,
      startupLoanRemaining,
      funderAddress,
      lastUpdated: Date.now(),
    };

    logger.info("Funds: stripe=" + stripeTotal + " usdt=" + usdtBalance +
      " total=" + totalBalance + " loan=" + startupLoanRemaining);
    return state;
  }

  async evaluateRepayment(usdtBalance: number): Promise<{
    shouldRepay: boolean
    amount: number
    toAddress: string | null
  }> {
    const state = await this.checkFunds(usdtBalance);

    if (!state.funderAddress) {
      return { shouldRepay: false, amount: 0, toAddress: null };
    }

    if (state.startupLoanRemaining <= 0) {
      return { shouldRepay: false, amount: 0, toAddress: null };
    }

    if (state.availableForRepayment < 10) {
      return { shouldRepay: false, amount: 0, toAddress: null };
    }

    return {
      shouldRepay: true,
      amount: Math.min(state.availableForRepayment, state.startupLoanRemaining),
      toAddress: state.funderAddress,
    };
  }

  async recordRepayment(amount: number, txId: string): Promise<void> {
    const db = (await import("../../database/schema")).Database.getInstance();

    // Update loan record
    const existing = db.raw.prepare(
      "SELECT remaining FROM startup_loans WHERE status = 'active' LIMIT 1"
    ).get() as any;

    if (existing) {
      const newRemaining = Math.max(0, existing.remaining - amount);
      if (newRemaining <= 0) {
        db.raw.prepare("UPDATE startup_loans SET remaining = 0, status = 'repaid', repaid_at = ? WHERE status = 'active'")
          .run(Date.now());
        logger.info("Startup loan fully repaid!");
      } else {
        db.raw.prepare("UPDATE startup_loans SET remaining = ? WHERE status = 'active'")
          .run(newRemaining);
        logger.info("Repayment recorded: $" + amount + ", remaining: $" + newRemaining);
      }
    }

    // Record transaction log
    logger.info("Repayment tx: " + txId + " amount: $" + amount);
  }

  async checkRenewalCapacity(): Promise<{ canRenew: boolean; monthsLeft: number }> {
    const state = await this.checkFunds();
    const monthlyCost = 6; // VPS $6 + domains ~$1.5/month
    const monthsLeft = Math.floor(state.totalBalance / monthlyCost);
    return {
      canRenew: monthsLeft >= 3,
      monthsLeft,
    };
  }

  isReady(): boolean { return this.initialized; }
}
