import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { BotConfig } from "../types";

dotenv.config();

/**
 * Required configuration keys that must be present at runtime.
 * Phase 2 keys are optional and checked separately.
 */
const REQUIRED_KEYS: (keyof BotConfig)[] = [
  "stripeSecretKey",
  "stripeWebhookSecret",
  "sechatServerUrl",
  "sechatBotApiKey",
  "sechatBotSecret",
  "databasePath",
];

function readEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Check your .env file or set it in the environment.`
    );
  }
  return value;
}

function readOptionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

function parseIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Load and validate the bot configuration from environment variables.
 * Throws on missing required values.
 */
export function loadConfig(): BotConfig {
  const config: BotConfig = {
    nodeEnv: readEnv("NODE_ENV", "development"),
    botName: readEnv("BOT_NAME", "SeChatbot"),
    botVersion: readEnv("BOT_VERSION", "1.0.0"),
    githubRepo: readEnv("GITHUB_REPO", "itszzl-sudo/sechat-security-chat-pwa-app"),
    githubBranch: readEnv("GITHUB_BRANCH", "main"),

    stripeSecretKey: readEnv("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: readEnv("STRIPE_WEBHOOK_SECRET"),
    stripePriceId: readOptionalEnv("STRIPE_PRICE_ID"),

    sechatServerUrl: readEnv("SECHAT_SERVER_URL"),
    sechatBotApiKey: readEnv("SECHAT_BOT_API_KEY"),
    sechatBotSecret: readEnv("SECHAT_BOT_SECRET"),

    namesiloApiKey: readOptionalEnv("NAMESILO_API_KEY"),
    cloudflareApiToken: readOptionalEnv("CLOUDFLARE_API_TOKEN"),
    digitaloceanPat: readOptionalEnv("DIGITALOCEAN_PAT"),
    usdtWalletPrivateKey: readOptionalEnv("USDT_WALLET_PRIVATE_KEY"),
    usdtWalletAddress: readOptionalEnv("USDT_WALLET_ADDRESS"),
    funderUsdtAddress: readOptionalEnv("FUNDER_USDT_ADDRESS"),
    imapHost: readOptionalEnv("IMAP_HOST"),
    imapPort: parseIntEnv("IMAP_PORT", 993),
    imapUser: readOptionalEnv("IMAP_USER"),
    imapPassword: readOptionalEnv("IMAP_PASSWORD"),
    smtpHost: readOptionalEnv("SMTP_HOST"),
    smtpPort: parseIntEnv("SMTP_PORT", 465),
    smtpUser: readOptionalEnv("SMTP_USER"),
    smtpPassword: readOptionalEnv("SMTP_PASSWORD"),

    databasePath: readEnv("DATABASE_PATH", "./data/sechatbot.db"),
    logLevel: readEnv("LOG_LEVEL", "info"),
    logFile: readEnv("LOG_FILE", "./logs/sechatbot.log"),
  };

  // Validate required keys
  for (const key of REQUIRED_KEYS) {
    const value = config[key];
    if (typeof value === "string" && (value === "" || value.startsWith("..."))) {
      throw new Error(
        `Configuration key "${key}" is empty or still has placeholder value. ` +
          `Please set a real value in your .env file.`
      );
    }
  }

  // Ensure data and logs directories exist
  const dataDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const logDir = path.dirname(config.logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return config;
}

/**
 * Returns a sanitized copy of the config (secrets masked) for logging.
 */
export function sanitizeConfig(config: BotConfig): Record<string, unknown> {
  const masked = { ...config } as Record<string, unknown>;
  const secrets: (keyof BotConfig)[] = [
    "stripeSecretKey",
    "stripeWebhookSecret",
    "sechatBotApiKey",
    "sechatBotSecret",
    "namesiloApiKey",
    "cloudflareApiToken",
    "digitaloceanPat",
    "usdtWalletPrivateKey",
    "imapPassword",
    "smtpPassword",
  ];
  for (const key of secrets) {
    if (masked[key] && typeof masked[key] === "string") {
      const val = masked[key] as string;
      masked[key] = val.slice(0, 4) + "****" + val.slice(-4);
    }
  }
  return masked;
}
