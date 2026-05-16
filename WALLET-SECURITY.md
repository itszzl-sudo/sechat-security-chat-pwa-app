# Bot 钱包安全方案

> *Bot 需要私钥签名交易，但私钥存储本身就是风险入口*

---

## 一、威胁模型

| 攻击方式 | 后果 | 概率 |
|---------|------|------|
| **VPS 被入侵** → 读取 .env | 私钥泄露，资金被盗 | 🟡 中 |
| **Bot 代码漏洞** → 内存 dump | 私钥泄露 | 🟡 中 |
| **备份泄露** → 配置文件暴露 | 私钥泄露 | 🟡 低 |
| **SSH Key 泄露** → 服务器登录 | 私钥泄露 | 🟡 中 |

**核心矛盾**: Bot 需要私钥才能签名交易 → 私钥必须在 Bot 可读的地方 → 攻击者攻破 Bot 就能读到私钥。

---

## 二、分层方案

### Level 1: 基础 (当前方案) — ❌ 不推荐

```
.env 文件:
  USDT_WALLET_PRIVATE_KEY=abc123...
```

风险: 服务器被入侵 = 资金被盗

### Level 2: 加密存储 — ✅ 最低要求

```
┌────────────────────────────────┐
│  .env 文件                       │
│  ENCRYPTED_KEY=7d8f2a...base64 │ ← AES-256 加密的私钥
│  KEY_PASSPHRASE=xxxx           │ ← 解密密钥（另一环境变量）
└────────────────────────────────┘

Bot 启动时:
  decrypt(ENCRYPTED_KEY, KEY_PASSPHRASE) → 私钥
  → 内存中使用
  → 用完清除

攻击者需要同时拿到两个环境变量才能解密
```

### Level 3: 冷热钱包分离 — ✅✅ 推荐

```
┌─────────────────────────────────────────────────────┐
│                     Bot 系统                           │
│                                                       │
│  ┌──────────────────┐    ┌────────────────────────┐  │
│  │  热钱包 (Hot)     │    │  冷钱包 (Cold)          │  │
│  │  Bot 持有私钥     │    │  多签 / 硬件钱包        │  │
│  │  余额: ≤ $100     │    │  余额: 超过 $100 部分   │  │
│  │  用途: 日常还贷    │    │  用途: 长期储备         │  │
│  │  风险: 可控 (小额)  │    │  风险: 几乎为零         │  │
│  └──────────────────┘    └────────────────────────┘  │
│         │                          ↑                  │
│         │  Bot 自动签名             │  需人工 / 多签    │
│         ▼                          │                  │
│  Sponsor 捐赠                         │                  │
│       → 热钱包满了 ($100+)           │                  │
│       → Bot 发起多签转账到冷钱包      │                  │
└─────────────────────────────────────┘                  │
```

**热钱包规则**:
```
余额 < $50  → 储备，不还款
余额 $50-$100 → 超出部分用于还贷
余额 > $100 → 超出 $100 的部分自动转冷钱包
```

### Level 4: 多签 (Multi-sig) — 终极方案

```
Bot 地址: 2-of-3 Multi-sig
  Key 1: Bot 持有（自动签名小额交易）
  Key 2: Sponsor 代表持有（签名大额交易）
  Key 3: 时间锁（3天后 Bot 可单独签名）

转账规则:
  < $50: 只需要 Key 1 (Bot 自动)
  $50-$500: 需要 Key 1 + Key 2
  > $500: 需要 Key 1 + Key 2 + 3天等待期
```

---

## 三、推荐实现：加密冷热钱包

### 钱包架构

```typescript
class BotWallet {
  private hotPrivateKey: string  // 解密后存在内存
  private coldAddress: string    // 冷钱包地址（只读）

  constructor() {
    // 热钱包私钥从加密的 .env 解密
    this.hotPrivateKey = decrypt(
      process.env.ENCRYPTED_HOT_KEY!,
      process.env.KEY_PASSPHRASE!
    )
    // 冷钱包地址硬编码（只能转入，不能从 Bot 转出）
    this.coldAddress = process.env.COLD_WALLET_ADDRESS!

    // 首次启动时自动生成热钱包
    this.ensureHotWallet()
  }

  private ensureHotWallet() {
    // 如果 .env 中没有加密的热钱包，Bot 自生成一个
    // 并将公钥打印到日志，让 Sponsor 可以转入
    if (!process.env.ENCRYPTED_HOT_KEY) {
      const { privateKey, address } = generateWallet()
      const encrypted = encrypt(privateKey, generatePassphrase())
      logger.info("NEW HOT WALLET: " + address)
      logger.info("ENCRYPTED KEY: " + encrypted)
      // 保存到 .env
    }
  }

  async getBalance(): Promise<number> {
    return getUSDTBalance(this.hotAddress)
  }

  async send(maxAmount: number, to: string): Promise<string> {
    const balance = await this.getBalance()
    const amount = Math.min(maxAmount, balance)
    if (amount > 100) {
      // 大额转账需要发通知，等人工确认
      throw new Error("Amount > $100 requires manual approval")
    }
    return signAndSend(this.hotPrivateKey, to, amount)
  }

  async sweepToCold(): Promise<string | null> {
    const balance = await this.getBalance()
    if (balance > 100) {
      const sweepAmount = balance - 50 // 留 $50 储备
      return this.send(sweepAmount, this.coldAddress)
    }
    return null
  }
}
```

### .env 配置

```bash
# 不需要人工注入私钥！Bot 首次启动自动生成
# ENCRYPTED_HOT_KEY=        ← Bot 首次运行后自动生成
# KEY_PASSPHRASE=           ← Bot 首次运行后自动生成
# COLD_WALLET_ADDRESS=      ← 由 Sponsor 提供，只能转入不能转出

# 如果想手动注入（安全性更高），可以预先生成：
# ENCRYPTED_HOT_KEY=aes256_base64_...
# KEY_PASSPHRASE=your_phrase
```

---

## 四、安全层级对照

| 方案 | 资金损失上限 | 需要人工 | Bot 自治度 | 推荐 |
|------|-----------|---------|-----------|------|
| **裸存私钥** | 全部资金 | 无 | 100% | ❌ |
| **加密存储** | 全部资金 | 无 | 100% | ⚠️ 最低要求 |
| **冷热分离** | **$100** | 大额转账时 | 日常 100% | ✅ **推荐** |
| **多签** | 取决于多签规则 | 中/大额 | 小额 100% | ✅ 终极方案 |

---

## 五、结论

**推荐: 冷热钱包分离 + 加密存储**

```
热钱包: ≤$100, Bot 完全自治
  私钥: AES-256 加密存 .env
  损失上限: $100

冷钱包: >$100, 需要多签
  私钥: 不存储在 Bot 上
  转移: 需要人工或第二把 Key

日常还贷: 热钱包自动进行 (≤$50/次)
超出部分: 自动转入冷钱包
```

**最坏情况**: VPS 被攻破 → 攻击者拿走热钱包最多 $100 → 冷钱包安全 → 总损失可控。
