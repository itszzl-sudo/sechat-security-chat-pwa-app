# 代码冻结与可信更新机制

> *防止开发者或其他任何人单方面篡改运行中的 Bot*

---

## 一、问题本质

```
传统模型:
  开发者 push 代码 → Bot 自动更新 → 开发者可以随时修改逻辑
  → 开发者能偷偷加后门、改钱包地址、篡改捐赠逻辑

可信模型:
  初始化时锁定版本 → 后续更新需 Sponsor 多签同意
  → 开发者也不能单方面修改运行中的 Bot
```

**这是去信任化的最后一步：不仅 Bot 不信任任何人，用户也不需要信任开发者。**

---

## 二、冻结机制

### 2.1 初始化锁定

```
Init Sponsor 启动 Bot
    ↓
Bot 记录当前 Git commit hash
    ↓
Bot 用自己钱包对 commit hash 签名
    ↓
签名结果存入数据库 + 区块链 (不可篡改)
    ↓
Bot 进入 LOCKED 模式
```

```typescript
// 初始化锁定
async function lockVersion(): Promise<void> {
  const commitHash = execSync('git rev-parse HEAD').toString().trim()

  // Bot 钱包签名
  const signature = await wallet.sign(commitHash)

  // 存入数据库
  db.raw.prepare(`
    INSERT INTO settings (key, value) VALUES ('locked_commit', ?)
  `).run(commitHash)

  db.raw.prepare(`
    INSERT INTO settings (key, value) VALUES ('locked_signature', ?)
  `).run(signature)

  // 写入区块链（存到链上备注）
  // await blockchain.store('LOCK:' + commitHash + ' SIG:' + signature)

  logger.info('CODE LOCKED at commit ' + commitHash.substring(0, 12))
}
```

### 2.2 锁定后的运行

```typescript
// Bot 每次启动时验证
async function verifyLock(): Promise<void> {
  const lockedHash = db.raw.prepare(
    "SELECT value FROM settings WHERE key = 'locked_commit'"
  ).get() as any

  if (!lockedHash) return // 首次启动，未锁定

  const currentHash = execSync('git rev-parse HEAD').toString().trim()

  if (currentHash !== lockedHash.value) {
    logger.error('CODE TAMPERED! Locked: ' + lockedHash.value.substring(0, 12)
      + ' Current: ' + currentHash.substring(0, 12))
    process.exit(1) // 不信任当前代码，拒绝运行
  }

  logger.info('Code integrity verified: ' + currentHash.substring(0, 12))
}
```

---

## 三、可信更新机制

### 3.1 更新流程

```
开发者提交代码 → GitHub PR
    ↓
Sponsor 审核代码
    ↓
K-of-N Sponsor 签署新 commit hash
    ↓
Bot 验证签名 → 签名来自 Sponsor 地址 → 解锁更新
```

### 3.2 签名验证

```typescript
// Sponsor 签署新版本
interface SignedUpdate {
  newCommitHash: string
  signatures: Array<{
    sponsorAddress: string  // Sponsor 的区块链地址
    signature: string       // 对 newCommitHash 的签名
    timestamp: number
  }>
}

// Bot 验证更新
async function verifyUpdate(update: SignedUpdate): Promise<boolean> {
  const threshold = 3 // 需要 3 个 Sponsor 签名

  if (update.signatures.length < threshold) {
    logger.warn('Not enough signatures: ' + update.signatures.length + '/' + threshold)
    return false
  }

  let validCount = 0
  for (const sig of update.signatures) {
    const isValid = await verifySignature(
      update.newCommitHash,
      sig.signature,
      sig.sponsorAddress
    )
    if (isValid) validCount++
  }

  if (validCount >= threshold) {
    logger.info('Update verified: ' + validCount + ' valid signatures')
    return true
  }

  logger.warn('Update rejected: only ' + validCount + ' valid signatures')
  return false
}
```

### 3.3 更新执行

```typescript
async function applyUpdate(update: SignedUpdate): Promise<void> {
  if (!await verifyUpdate(update)) return

  // 拉取新代码
  execSync('git fetch origin main')
  execSync('git checkout ' + update.newCommitHash)

  // 锁定新版本
  const newSignature = await wallet.sign(update.newCommitHash)
  db.raw.prepare("UPDATE settings SET value = ? WHERE key = 'locked_commit'")
    .run(update.newCommitHash)
  db.raw.prepare("UPDATE settings SET value = ? WHERE key = 'locked_signature'")
    .run(newSignature)

  logger.info('Updated to ' + update.newCommitHash.substring(0, 12))

  // 重启
  process.exit(0)
}
```

---

## 四、安全设计

### 4.1 防止开发者作恶

| 攻击方式 | 防御 |
|---------|------|
| **开发者 push 后门** | Bot 拒绝运行未锁定版本的代码 |
| **开发者修改锁定记录** | 锁记录同时存链上，篡改可发现 |
| **开发者替换数据库** | 链上签名与本地不一致 → 告警 |
| **开发者物理访问 VPS** | 可以改代码，但改完 Bot 拒绝启动 |

### 4.2 防止 Sponsor 集体作恶

如果 ≥K 个 Sponsor 串通签署恶意更新：
```
→ 这个模型防不了。
→ 但 Sponsor 的利益和项目绑定（他们捐了钱）
→ 集体作恶的动机远低于开发者单方作恶
→ 如果实在担心，可以引入时间锁：签名后 7 天才能执行
```

### 4.3 紧急恢复

```
万一所有 Sponsor 都联系不上且需要紧急修复：
  1. 物理访问 VPS
  2. 删除 locked_commit 记录
  3. 重启 Bot
  4. Bot 检测到锁定被移除 → 记录告警
  5. 正常运行但标记为 UNTRUSTED 模式
```

---

## 五、与现有 SelfUpdater 的关系

```typescript
class SelfUpdater {
  async checkForUpdates(): Promise<string | null> {
    // 原逻辑: 检查 GitHub 是否有新 commit
    const latest = await getLatestCommit()

    // 新增: 检查是否有 Sponsor 签署的更新包
    const signedUpdate = await checkForSignedUpdate()

    if (signedUpdate && await verifyUpdate(signedUpdate)) {
      return signedUpdate.newCommitHash
    }

    // 如果没有签署的更新，即使 GitHub 有新代码也不更新
    return null
  }
}
```

---

## 六、与 init sponsor 的关系

```
Init Sponsor 启动 Bot:
  1. Bot 生成密钥对
  2. Bot 锁定当前代码版本
  3. Init Sponsor 的地址被记录为初始信任锚点

此时:
  - 开发者可以继续写代码、push 到 GitHub
  - Bot 不会运行新代码
  - 只有 Init Sponsor 签署后才能更新

Init Sponsor 可以:
  - 自己审核新代码
  - 签署更新
  - 或者把签署权委托给更多 Sponsor（多签阈值可调）
```

---

## 七、总结

| 特性 | 传统方案 | 本方案 |
|------|---------|-------|
| 开发者能否偷偷改代码 | ✅ 能 | ❌ 不能 |
| 更新需要谁同意 | 开发者本人 | K-of-N Sponsor |
| 初始化后开发者还有控制权 | ✅ 完全控制 | ❌ 零控制 |
| 紧急恢复能力 | 开发者随时可以 | Sponsor 多签或物理访问 |

**一句话**: 代码版本在 init sponsor 启动时锁死。开发者之后 push 的任何代码，Bot 都不会执行，除非 ≥K 个 sponsor 签名同意。
