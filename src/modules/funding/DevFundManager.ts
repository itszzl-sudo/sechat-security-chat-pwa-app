import { getLogger } from "../../config/logger";

const logger = getLogger();

export class DevFundManager {
  private initialized = false;
  private readonly MIN_DEV_FUND = 50; // $50/month minimum for dev team
  private readonly BOT_RESERVE = 50;  // $50 reserve for bot ops

  async initialize(): Promise<boolean> {
    this.initialized = true;
    logger.info("DevFundManager initialized");
    return true;
  }

  // Check GitHub Sponsor income for the dev team
  async checkDevSponsorIncome(): Promise<number> {
    try {
      const token = process.env.GITHUB_TOKEN || "";
      if (!token) { logger.warn("GITHUB_TOKEN not set, cannot check dev sponsor income"); return 0; }
      const repo = process.env.GITHUB_REPO || "itszzl-sudo/sechat-security-chat-pwa-app";
      const axios = require("axios");
      const resp = await axios.get("https://api.github.com/repos/" + repo + "/sponsors", {
        headers: { Authorization: "token " + token }
      });
      // GitHub API returns sponsor listings, estimate monthly income
      const sponsors = resp.data || [];
      let monthly = 0;
      for (const s of sponsors) {
        monthly += s.tier?.monthly_price_in_cents || 0;
      }
      const monthlyUsd = monthly / 100;
      logger.info("Dev GitHub Sponsor income: ~$" + monthlyUsd + "/month");
      return monthlyUsd;
    } catch (err) {
      logger.warn("Failed to check dev sponsor income: " + err);
      return 0;
    }
  }

  // Decide if bot should redirect funds to dev team
  async evaluateDevSupport(botUsdtBalance: number): Promise<{
    shouldSupport: boolean;
    amount: number;
    reason: string;
  }> {
    const devIncome = await this.checkDevSponsorIncome();

    if (devIncome >= this.MIN_DEV_FUND) {
      return { shouldSupport: false, amount: 0, reason: "Dev team income ($" + devIncome + "/mo) meets minimum ($" + this.MIN_DEV_FUND + ")" };
    }

    const shortfall = this.MIN_DEV_FUND - devIncome;
    const affordable = botUsdtBalance - this.BOT_RESERVE;

    if (affordable <= 0) {
      return { shouldSupport: false, amount: 0, reason: "Bot cannot afford support (balance: $" + botUsdtBalance + ")" };
    }

    const amount = Math.min(shortfall, affordable, 100); // cap at $100/mo
    return {
      shouldSupport: true,
      amount,
      reason: "Dev income $" + devIncome + "/mo < $" + this.MIN_DEV_FUND + ". Sending $" + amount,
    };
  }

  async isReady(): Promise<boolean> { return this.initialized; }
}