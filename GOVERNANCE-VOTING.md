# 社区治理升级机制

> *用户投票选择版本，Bot 执行升级。投票通过率极高，因为不可回退。*

---

## 一、投票权重

按 Sponsor 等级分配投票权（而不是按人头），因为 Sponsor 有实际经济投入：

| 角色 | 投票权重 | 最低捐赠 |
|------|---------|---------|
| General Sponsor | **1 票** | ≥ $1 |
| Senior Sponsor | **5 票** | ≥ $10 |
| Core Sponsor | **20 票** | ≥ $100 |
| Sole Exclusive Sponsor | **80 票** | ≥ $500 |
| Reserve Fund Sponsor | **300 票** | ≥ $1000 |

**总投票权 = 所有 Sponsor 的权重之和**

---

## 二、投票参数

| 参数 | 值 | 说明 |
|------|-----|------|
| **投票期** | 7 天 | 从提案创建到投票截止 |
| **通过门槛** | **≥80% 赞成票** | 因为不可回退，要求极高共识 |
| **最低参与率 (Quorum)** | **≥30% 总投票权** | 防止少数人决定升级 |
| **Sponsor 否决权** | Reserve Fund Sponsor 可一票否决 | 最高级 Sponsor 的制衡机制 |

---

## 三、升级流程

```
开发者 push 新版本到 GitHub
    ↓
Bot 检测到新版本 → 创建升级提案
    ├─ commit hash
    ├─ 代码变更摘要
    ├─ 投票截止时间 (7天后)
    └─ 当前赞成/反对票数
    ↓
提案推送到 sechat server
    ↓
Sponsor 在 sechat 中看到投票入口
    ↓
Sponsor 投票 (赞成/反对)
    ↓
7 天后投票截止
    ↓
Bot 计票:
    ├─ 参与率 < 30% → 提案失败，标记为"参与率不足"
    ├─ 赞成率 < 80% → 提案失败，标记为"未通过"
    └─ 赞成率 ≥ 80% → 执行升级!
```

---

## 四、与代码锁定的关系

```
代码锁定后:
  Bot 每次发现新版本，不是直接更新
  而是创建投票提案 → 等待 7 天 → 社区决定

升级后:
  新版本自动锁定 → 旧版本不可回退
  如果需要再次升级 → 再次投票

不可回退的原因:
  Bot 自持完整私钥（L0-L1 阶段）
  旧版本的代码可能已经不再维护
  回退 = 安全漏洞
```

---

## 五、代码实现

### 5.1 数据库表

```sql
CREATE TABLE upgrade_proposals (
  id TEXT PRIMARY KEY,
  target_commit TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  proposer TEXT,                    -- 谁发起的
  created_at INTEGER NOT NULL,
  voting_end_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',    -- pending | approved | rejected | quorum_failed
  yes_votes REAL DEFAULT 0,         -- 累计赞成权重
  no_votes REAL DEFAULT 0,          -- 累计反对权重
  total_voting_power REAL DEFAULT 0 -- 总投票权
);

CREATE TABLE upgrade_votes (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,           -- sechat user id
  voter_username TEXT NOT NULL,
  vote TEXT NOT NULL,               -- yes / no
  weight REAL NOT NULL,             -- 投票权重
  voted_at INTEGER NOT NULL,
  FOREIGN KEY (proposal_id) REFERENCES upgrade_proposals(id)
);
```

### 5.2 投票引擎

```typescript
class GovernanceVoting {
  // 创建升级提案
  async createProposal(commitHash: string, title: string, description: string): Promise<string> {
    const db = Database.getInstance()
    const id = 'proposal_' + randomSuffix(8)
    const now = Date.now()
    const votingEnd = now + 7 * 24 * 3600 * 1000  // 7 days

    // 计算总投票权
    const sponsors = db.raw.prepare("SELECT SUM(weight) as total FROM sponsor_weights WHERE active = 1").get() as any
    const totalPower = sponsors?.total || 0

    db.raw.prepare("INSERT INTO upgrade_proposals VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)")
      .run(id, commitHash, title, description, 'bot', now, votingEnd, totalPower)

    logger.info("Proposal created: " + id + " -> " + commitHash.substring(0, 12) + " ends " + new Date(votingEnd).toISOString())
    return id
  }

  // 投票
  async castVote(proposalId: string, userId: string, username: string, vote: 'yes' | 'no'): Promise<boolean> {
    const db = Database.getInstance()

    // 检查提案是否存在且在投票期内
    const proposal = db.raw.prepare("SELECT * FROM upgrade_proposals WHERE id = ? AND status = 'pending'").get(proposalId) as any
    if (!proposal) return false
    if (Date.now() > proposal.voting_end_at) return false

    // 检查是否已经投过
    const existing = db.raw.prepare("SELECT id FROM upgrade_votes WHERE proposal_id = ? AND voter_id = ?").get(proposalId, userId) as any
    if (existing) return false  // 不能重复投票

    // 获取投票权重
    const weight = this.getVoterWeight(userId)

    db.raw.prepare("INSERT INTO upgrade_votes VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run('vote_' + randomSuffix(8), proposalId, userId, username, vote, weight, Date.now())

    // 更新累计票数
    if (vote === 'yes') {
      db.raw.prepare("UPDATE upgrade_proposals SET yes_votes = yes_votes + ? WHERE id = ?").run(weight, proposalId)
    } else {
      db.raw.prepare("UPDATE upgrade_proposals SET no_votes = no_votes + ? WHERE id = ?").run(weight, proposalId)
    }

    logger.info("Vote cast: " + username + " (" + weight + " votes) -> " + vote + " on " + proposalId)
    return true
  }

  // 获取投票者权重
  private getVoterWeight(userId: string): number {
    const db = Database.getInstance()
    const sponsor = db.raw.prepare("SELECT current_role, total_donated FROM sponsors WHERE sechat_user_id = ?").get(userId) as any
    if (!sponsor) return 0

    // 基于捐赠额: $1 = 1 票
    const donationWeight = Math.floor((sponsor.total_donated || 0) / 100)  // in cents
    return Math.max(donationWeight, 1)
  }

  // 统计投票结果
  async tallyVotes(proposalId: string): Promise<{ status: string; yesPct: number; participation: number }> {
    const db = Database.getInstance()
    const proposal = db.raw.prepare("SELECT * FROM upgrade_proposals WHERE id = ?").get(proposalId) as any
    if (!proposal) return { status: 'not_found', yesPct: 0, participation: 0 }

    const totalVoted = proposal.yes_votes + proposal.no_votes
    const participation = proposal.total_voting_power > 0 ? totalVoted / proposal.total_voting_power : 0
    const yesPct = totalVoted > 0 ? proposal.yes_votes / totalVoted : 0

    if (participation < 0.3) return { status: 'quorum_failed', yesPct: 0, participation }
    if (yesPct < 0.8) return { status: 'rejected', yesPct, participation }

    return { status: 'approved', yesPct, participation }
  }
}
```

### 5.3 定时任务

```typescript
// 每小时检查是否有到期的提案
scheduler.onInternal('task:proposal_tally', async () => {
  const proposals = db.raw.prepare(
    "SELECT * FROM upgrade_proposals WHERE status = 'pending' AND voting_end_at < ?"
  ).all(Date.now())

  for (const p of proposals) {
    const result = await voting.tallyVotes(p.id)

    if (result.status === 'approved') {
      // 执行升级！
      logger.info('Proposal ' + p.id + ' APPROVED: ' + (result.yesPct * 100).toFixed(1) + '%赞成')
      await selfUpdater.applySignedUpdate({
        newCommitHash: p.target_commit,
        signatures: []  // 投票结果本身具有效力
      })
    } else {
      logger.info('Proposal ' + p.id + ' ' + result.status.toUpperCase() + ': ' +
        (result.yesPct * 100).toFixed(1) + '%赞成, ' + (result.participation * 100).toFixed(1) + '%参与')
      db.raw.prepare("UPDATE upgrade_proposals SET status = ? WHERE id = ?").run(result.status, p.id)
    }
  }
})
```

---

## 六、总结

| 特性 | 值 |
|------|-----|
| **投票权** | 基于捐赠额 ($1 = 1 票) |
| **投票期** | 7 天 |
| **通过门槛** | ≥80% 赞成 |
| **最低参与率** | ≥30% 总投票权 |
| **否决权** | Reserve Fund Sponsor 可一票否决 |
| **不可回退** | 升级后无法回到旧版本 |
| **触发方式** | Bot 检测到新版本时自动创建提案 |
