# 自适应密钥保护策略

> *根据用户规模动态调整安全等级，用户不足时不自欺欺人*

---

## 一、核心原则

**用户群是安全的基础设施。用户不够，就不要强行分布式。**

```
用户少 → Bot 自持完整密钥 (但加密)
用户多 → 逐步迁移到分片存储
用户足够 → Bot 自持 1 片，其余分给用户
```

---

## 二、自适应等级

| 等级 | 用户数 (DAU) | Bot 自持 | 分片策略 | 风险承受 |
|------|-------------|---------|---------|---------|
| **L0** | < 10 | ✅ 完整私钥 (AES加密) | ❌ 不分裂 | VPS 被攻破 = 全部损失 |
| **L1** | 10-50 | ✅ 完整私钥 + 加密 | ⚠️ 试分片但不依赖 | 同上 |
| **L2** | 50-200 | ✅ 自持 1 片 | ✅ 4/7 分片，K=3 | 需攻破 VPS + 2用户 |
| **L3** | > 200 | ✅ 自持 1 片 | ✅ 4/7 分片，K=4 | 需攻破 VPS + 3用户 |
| **L4** | > 1000 | ✅ 自持 0 片 | ✅ 5/9 分片，K=5 | 需攻破 5用户 |

### 降级规则

```
用户数下降 → 安全等级自动降级
  例如: L3 → L2: 分片阈值从 K=4 降为 K=3
        L2 → L1: Bot 从自持 1 片改为自持完整私钥
        L1 → L0: 恢复裸存加密私钥

任何时候分片收集失败 → 回退到 Bot 本地存储
```

---

## 三、代码实现

```typescript
class AdaptiveWallet {
  private securityLevel: 0 | 1 | 2 | 3 | 4 = 0
  private botSelfStore: string | null = null  // Bot 本地存储的密钥（加密）
  private shards: Map<string, string> = new Map() // 收集到的分片

  // 每次签名前评估当前安全等级
  async assessSecurityLevel(): Promise<number> {
    const dau = await this.getDAU()  // 从 sechat server 获取日活
    const totalUsers = await this.getTotalUsers()

    if (totalUsers > 1000 && dau > 200) return 4
    if (totalUsers > 500 && dau > 100) return 3
    if (totalUsers > 100 && dau > 30) return 2
    if (totalUsers > 20 && dau > 5) return 1
    return 0
  }

  // 签名交易
  async signTransaction(tx: Transaction): Promise<string> {
    const level = await this.assessSecurityLevel()
    let privateKey: string

    if (level >= 2 && this.hasEnoughShards(level)) {
      // 分片模式: 收集分片 + Bot 自持 1 片
      const shardList = await this.collectRemoteShards(level)
      privateKey = KeySharder.join([this.botSelfStore!, ...shardList])
    } else {
      // 本地模式: Bot 直接用自己存的完整私钥
      privateKey = this.decryptLocalKey()
    }

    const signature = sign(tx, privateKey)
    this.wipe(privateKey)
    return signature
  }

  // 收集分片（带超时和降级）
  async collectRemoteShards(level: number): Promise<string[]> {
    const needed = level >= 3 ? 3 : level >= 2 ? 2 : 0
    if (needed === 0) return []

    const collected: string[] = []
    const timeout = 30000 // 30 秒超时

    // 向在线 Sponsor 发起分片收集请求
    const request = { action: 'shard_collect', txId: tx.id }
    this.broadcastToSponsors(request)

    return new Promise((resolve) => {
      setTimeout(() => {
        if (collected.length < needed) {
          // 分片不够！降级到本地签名
          logger.warn('Shard collection failed: got ' + collected.length + '/' + needed + ', falling back to local')
          resolve([])  // 返回空数组，触发降级路径
        }
        resolve(collected)
      }, timeout)
    })
  }
}
```

---

## 四、多级降级流程

```
Bot 需要签名
    │
    ▼
评估安全等级
    │
    ├─ L0/L1 → 直接使用本地加密私钥
    │
    └─ L2/L3/L4 → 尝试分片收集
         │
         ├─ 收集成功并满足阈值 → 重构私钥 → 签名
         │
         └─ 收集失败 → 降级到 L1
              │
              ├─ Bot 使用本地加密私钥 → 签名
              │
              └─ 记录告警: "用户不足，安全等级从 L{n} 降至 L1"
```

---

## 五、与 bot 自持方案的关系

**bot 永远保留自持能力**，只是自持的完整度随用户数变化：

| 等级 | Bot 本地存什么 | 能不能独立签名 |
|------|--------------|-------------|
| L0 | 完整加密私钥 | ✅ 随时可以 |
| L1 | 完整加密私钥 | ✅ 随时可以 |
| L2 | 加密私钥 + 分片 S1 | ⚠️ 可以（降级到 L1） |
| L3 | 分片 S1 | ✅ 需收集 3 个用户分片 |
| L4 | 分片 S1 | ✅ 需收集 4 个用户分片 |

**L0-L2 阶段，Bot 分不分享片都不影响正常功能。**
**L3-L4 阶段，如果分片收集失败，自动降回 L1。**

---

## 六、当前状态

```
当前 sechatbot 代码:
  BotWallet.ts → L0: 完整私钥加密存储
                 ？+ 冷热分离 (热钱包 ≤$100)
  
  这就是 L0，完全正确。用户不够的时候不要装。
```

### 何时升级到 L1+

```
升级条件:
  sechat DAU > 10 且 稳定运行 30 天
  → Bot 开始尝试分片但不依赖
  → 不影响现有功能

升级条件:
  sechat DAU > 50 且 稳定运行 90 天
  → Bot 切换到分片优先
  → 本地保留完整私钥作为 fallback
```

---

## 七、结论

**当前实现 (BotWallet L0) 对当前阶段完全正确。** 不要预先做用不上的分布式架构。

```
现在:   L0  →  加密存储 + 冷热分离          ← 就在这里
用户 10+: L1  →  + 尝试分片 (不依赖)         ← 下一步
用户 50+: L2  →  + 分片优先 + 本地 fallback  ← 未来
用户 200+: L3 →  + 分片必需 (仍有 fallback)   ← 很远的未来
```
