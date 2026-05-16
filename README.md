# SeChatbot — Autonomous Operator

> *Self-deploying, self-funding, self-governing bot for the sechat secure messaging platform*

SeChatbot is an autonomous bot that manages the entire lifecycle of the sechat platform:
- Domain registration & cross-registrar security
- Cloud VPS deployment & Docker orchestration
- Stripe + USDT payment processing
- Sponsor role management & governance voting
- AI-powered code audit for upgrades
- Multi-version deployment with auto-deprecation
- Developer fund support

---

## Quick Start

```bash
git clone https://github.com/itszzl-sudo/sechat-security-chat-pwa-app.git
cd sechatbot
cp .env.example .env
# Edit .env with your API keys
npm install
npm run build
npm start
```

## Architecture

```
src/
├── engine/          Boot, Scheduler, StateManager
├── database/        SQLite schema (13 tables)
├── config/          Config loader + Logger
├── types/           TypeScript interfaces
├── modules/
│   ├── domain/      Scanner, Porkbun, Cloudflare, NameSilo, DomainManager
│   ├── deploy/      DigitalOcean, SSH, Docker, DeployManager
│   ├── payment/     Stripe, USDTMonitor, BotWallet
│   ├── sponsor/     SponsorManager
│   ├── sechat/      SeChatClient (REST + WebSocket)
│   ├── email/       IMAPClient, SMTPClient, EmailAgent
│   ├── ops/         HealthMonitor, FundManager, SelfUpdater
│   ├── audit/       AICodeAuditor, ReleaseManager
│   ├── governance/  GovernanceVoting
│   ├── version/     VersionManager
│   └── funding/     DevFundManager
└── index.ts         Entry point
```

## Sponsor Roles

| Role | Min Donation | Badge |
|------|-------------|-------|
| General Sponsor | $1 | GS |
| Senior Sponsor | $10 | SS |
| Core Sponsor | $50 | CS |
| Sole Exclusive Sponsor | $250 | SES |
| Reserve Fund Sponsor | $1,000 | RFS |

## Key Features

| Feature | Description |
|---------|-------------|
| **Code Lock** | Version frozen at init. Updates need 3+ sponsor signatures. |
| **AI Audit** | Static analysis + GPT-4 review blocks backdoors before voting. |
| **Governance** | Sponsor-weighted voting, 80% threshold, 7-day window. |
| **Wallet** | AES-256-GCM encrypted hot wallet, cold wallet sweep. |
| **Adaptive Security** | Auto-adjusts protection based on user count and amount. |
| **Multi-Version** | Run N versions in parallel, auto-deprecate old ones. |
| **Dev Support** | Monitors GitHub Sponsor income, redirects funds if needed. |

## Configuration

See `.env.example` for all 36+ environment variables.

---

<br>

# SeChatbot — 自主运营系统

> *自我部署、自我融资、自我治理的 sechat 安全通讯平台 Bot*

SeChatbot 是一个自主机器人，管理 sechat 平台的完整生命周期：
- 域名注册与跨注册商安全
- 云 VPS 部署与 Docker 编排
- Stripe + USDT 支付处理
- 赞助商角色管理与治理投票
- AI 代码审计升级
- 多版本并行部署与自动淘汰
- 开发者资金支持

## 快速开始

```bash
git clone https://github.com/itszzl-sudo/sechat-security-chat-pwa-app.git
cd sechatbot
cp .env.example .env
# 编辑 .env 填入你的 API 密钥
npm install
npm run build
npm start
```

## 赞助商角色

| 角色 | 最低捐赠 | 徽标 |
|------|---------|------|
| General Sponsor | $1 | GS |
| Senior Sponsor | $10 | SS |
| Core Sponsor | $50 | CS |
| Sole Exclusive Sponsor | $250 | SES |
| Reserve Fund Sponsor | $1,000 | RFS |

## 核心特性

| 特性 | 说明 |
|------|------|
| **代码锁定** | 初始化时冻结版本，更新需 3+ 赞助商签名 |
| **AI 审计** | 静态分析 + GPT-4 审查，投票前拦截后门 |
| **治理投票** | 赞助商加权投票，80% 通过门槛，7 天窗口 |
| **钱包安全** | AES-256-GCM 加密热钱包 + 自动扫入冷钱包 |
| **自适应安全** | 根据用户量和金额自动调整保护等级 |
| **多版本支持** | 同时运行 N 个版本，自动淘汰老旧版本 |
| **开发者支持** | 监控 GitHub Sponsor 收入，必要时拨付资金 |

## 配置说明

详见 `.env.example`，共 36+ 个环境变量。

---

## License MIT
