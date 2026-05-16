// ─── Sponsor Role Types (mirrors sechat client) ───────────────────────────────

export type SponsorRole =
  | "general_sponsor"
  | "senior_sponsor"
  | "core_sponsor"
  | "sole_exclusive_sponsor"
  | "reserve_fund_sponsor"
  | "none";

export interface SponsorRoleInfo {
  label: string;
  badge: string;
  color: string;
  level: number;
}

export const SPONSOR_ROLE_DISPLAY: Record<SponsorRole, SponsorRoleInfo> = {
  general_sponsor: {
    label: "General Sponsor",
    badge: "GS",
    color: "#95a5a6",
    level: 1,
  },
  senior_sponsor: {
    label: "Senior Sponsor",
    badge: "SS",
    color: "#f1c40f",
    level: 2,
  },
  core_sponsor: {
    label: "Core Sponsor",
    badge: "CS",
    color: "#e67e22",
    level: 3,
  },
  sole_exclusive_sponsor: {
    label: "Sole Exclusive Sponsor",
    badge: "SES",
    color: "#9b59b6",
    level: 4,
  },
  reserve_fund_sponsor: {
    label: "Reserve Fund Sponsor",
    badge: "RFS",
    color: "#e74c3c",
    level: 5,
  },
  none: { label: "", badge: "", color: "", level: 0 },
};

// ─── SeChat User/Chat Types (mirrors sechat client) ──────────────────────────

export interface SeChatUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen?: number;
  sponsorRole: SponsorRole;
}

export interface SeChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  contentType: "text" | "image" | "system";
  timestamp: number;
  encrypted: boolean;
  selfDestruct?: number;
  readAt?: number;
  editedAt?: number;
}

export interface SeChatChat {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unread: number;
  isVerified?: boolean;
}

// ─── Bot Configuration ────────────────────────────────────────────────────────

export interface BotConfig {
  nodeEnv: string;
  botName: string;
  botVersion: string;
  githubRepo: string;
  githubBranch: string;

  // Stripe
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePriceId?: string;

  // SeChat
  sechatServerUrl: string;
  sechatBotApiKey: string;
  sechatBotSecret: string;

  // Phase 2 optional
  namesiloApiKey?: string;
  porkbunApiKey?: string;
  porkbunSecretKey?: string;
  cloudflareApiToken?: string;
  digitaloceanPat?: string;
  usdtWalletPrivateKey?: string;
  usdtWalletAddress?: string;
  funderUsdtAddress?: string;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;

  // Database
  databasePath: string;

  // Logging
  logLevel: string;
  logFile: string;
}

// ─── Domain Management ────────────────────────────────────────────────────────

export interface DomainRecord {
  id: string;
  domain: string;
  registrar: "namesilo" | "cloudflare";
  whoisEmail: string;
  status: "pending" | "active" | "expiring" | "expired" | "transferred";
  registeredAt: number;
  expiresAt: number;
  autoRenew: boolean;
  dnsConfigured: boolean;
  verified: boolean;
}

// ─── Payment / Donation ───────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  stripePaymentIntentId: string;
  stripeCustomerId?: string;
  amount: number; // in cents
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  sponsorUserId?: string; // sechat user id
  sponsorUsername?: string;
  metadata: Record<string, string>;
  createdAt: number;
  completedAt?: number;
}

// ─── Sponsor ──────────────────────────────────────────────────────────────────

export interface SponsorRecord {
  id: string;
  sechatUserId: string;
  sechatUsername: string;
  totalDonated: number; // in cents (USD)
  currentRole: SponsorRole;
  lastDonationAt?: number;
  firstDonationAt: number;
  updatedAt: number;
}

export interface RoleThreshold {
  role: SponsorRole;
  minAmountCents: number;
  description: string;
}

// ─── Deployment ───────────────────────────────────────────────────────────────

export interface DeploymentState {
  phase: "none" | "seeding" | "domain" | "infra" | "payment" | "operational";
  step: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  metadata: Record<string, string>;
}

// ─── Task Logging ─────────────────────────────────────────────────────────────

export interface TaskLog {
  id: string;
  taskName: string;
  status: "running" | "success" | "failure" | "skipped";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  details?: string;
}

// ─── Module Health ────────────────────────────────────────────────────────────

export interface ModuleHealth {
  moduleName: string;
  status: "healthy" | "degraded" | "down";
  lastCheckAt: number;
  lastError?: string;
  uptimeMs: number;
  metadata: Record<string, unknown>;
}

// ─── Settings (key-value store) ───────────────────────────────────────────────

export interface SettingRecord {
  key: string;
  value: string;
  updatedAt: number;
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export type WsEventType =
  | "message"
  | "user_status"
  | "sponsor_update"
  | "friend_request"
  | "group_update"
  | "system";

export interface WsEvent {
  type: WsEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Startup Loan (Repayment Mechanism) ──────────────────────────────────────

export interface StartupLoan {
  funderAddress: string;
  principalAmountUsdt: number; // in USDT (cents precision)
  contributedAt: number;
  status: "active" | "repaying" | "repaid" | "defaulted";
  totalRepaid: number;
  lastRepaymentAt?: number;
  repaidAt?: number;
}

export interface FundPool {
  totalBalanceUsdt: number;
  reservedForOperations: number;
  availableForRepayment: number;
  lastUpdatedAt: number;
}


// ─── Phase 2: Domain Scanner Types ─────────────────────────────────────────

export interface DomainCandidate {
  domain: string
  tld: string
  score: number
  available?: boolean
  price?: number
}

export interface DomainScanResult {
  candidates: DomainCandidate[]
  selected: DomainCandidate[]
  timestamp: number
}

// ─── Phase 2: VPS / Cloud Types ────────────────────────────────────────────

export interface VPSSpec {
  provider: 'digitalocean' | 'aws' | 'hetzner'
  region: string
  size: string
  image: string
}

export interface VPSInstance {
  id: string
  name: string
  ip: string
  region: string
  size: string
  status: 'new' | 'active' | 'stopped' | 'destroyed'
  createdAt: number
}

export interface DeploymentStatus {
  vpsId: string
  domainId: string
  sechatVersion: string
  botVersion: string
  url: string
  healthStatus: 'unknown' | 'healthy' | 'degraded' | 'down'
  lastHealthCheck: number
  deployedAt: number
}

// ─── Phase 2: Email Types ──────────────────────────────────────────────────

export interface EmailMessage {
  id: string
  from: string
  to: string
  subject: string
  body: string
  htmlBody?: string
  attachments: Array<{ filename: string; content: Buffer }>
  receivedAt: number
}

export interface EmailVerificationLink {
  url: string
  domain: string
  registrar: string
  email: string
  type: 'whois_verification' | 'transfer_approval' | 'dns_change'
}

// ─── Phase 2: SSH Types ────────────────────────────────────────────────────

export interface SSHConnection {
  host: string
  port: number
  username: string
  privateKey: string
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

// ─── Phase 2: Docker Types ─────────────────────────────────────────────────

export interface DockerService {
  name: string
  image: string
  port: number
  env: Record<string, string>
  volumes: string[]
  dependsOn: string[]
}


// ─── Version Tracking ───────────────────────────────────────────────

export interface VersionRecord {
  version: string;
  commitHash: string;
  deployedAt: number;
  status: "active" | "deprecated" | "sunset";
  userCount: number;
  dailyActiveUsers: number;
  adoptionPct: number; // 0-100
  lastHeartbeatAt: number;
}

export interface VersionHeartbeat {
  version: string;
  userId: string;
  username: string;
  timestamp: number;
  userAgent: string;
}

// Phase 2+: DNS and Registrar types

export interface DNSRecord {
  name: string
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'
  content: string
  ttl?: number
  priority?: number
}
