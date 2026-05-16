# Bootstrap Guide

> *The ~15-minute manual setup to get SeChatbot from "needs a human" to "fully autonomous"*

## Step 1: Register Accounts (10 min)

1. **GitHub**: Generate PAT with `repo` scope
2. **Stripe**: Get Secret Key + Webhook Secret
3. **Optional**: NameSilo, Cloudflare, Porkbun, DigitalOcean API keys

## Step 2: Fund the Bot

Deposit ~$100 via Stripe or send USDT to bot's auto-generated address.

## Step 3: Start

```bash
cp .env.example .env
# Edit .env with your keys
npm install && npm run build && npm start
```

On first start, the bot auto-generates its blockchain wallet and locks the code.

## What Happens After
- Phase 1 (Day 1): Payment processing, sponsor roles
- Phase 2 (Day 1-2): Domain registration, VPS deployment
- Phase 3 (Day 2+): Code lock, AI audit, governance voting, version tracking

## Recovery
- **Code lock error**: `git checkout <locked-commit>` or delete lock from DB
- **Database corruption**: Restore from backup or delete and restart
