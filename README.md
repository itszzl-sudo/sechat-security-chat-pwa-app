# SeChat — Secure Messenger

> *Passwordless. Private. Protected.*

**SeChat** is a privacy-first, end-to-end encrypted secure messaging application designed exclusively for iPhone users. It combines **Signal Protocol** encryption with **WebGPU** hardware-accelerated anti-screenshot and anti-recording protection, creating a truly secure communication platform.

---

## ✨ Features

### 🔐 End-to-End Encryption (Signal Protocol)
- **ECDH P-256** key agreement with **AES-256-GCM** encryption
- **X3DH** (Extended Triple Diffie-Hellman) key exchange protocol
- **Perfect Forward Secrecy** — compromised keys cannot decrypt past messages
- **Double Ratchet Algorithm** for continuous key rotation
- Every message is encrypted before transmission

### 🛡️ Anti-Screenshot & Anti-Recording (WebGPU)
- **WebGPU Compute Shaders** apply dynamic noise patterns invisible to the human eye but disruptive to cameras and screen recording
- **Moiré pattern generation** interferes with photographing the screen
- **Temporal noise** changes every frame, making video recording unusable
- **Watermark overlay** — SeChat PROTECTED subtly rendered on screen
- **Ambient light monitoring** detects camera flash/AF assist light
- **Device orientation analysis** detects when device is laid flat (external camera photography)
- **Performance monitoring** detects screen recording overhead via frame drop analysis
- **Screenshot auto-blur** — blur(24px) brightness(0.2) on detection, with red warning overlay

### 🔑 Passwordless Authentication
- **WebAuthn** (Web Authentication API) — Face ID, Touch ID, Windows Hello
- **Microsoft Authenticator** fallback via **TOTP** (RFC 6238, 30-second window, 6-digit codes)
- **Random username generation** — User_X7k3M9 style, no password needed
- **5-minute registration lock** — username reserved during registration, auto-released on timeout
- **Username uniqueness enforced** — once registered, username cannot be reused

### 👥 Friend & Group System
- **Search users** by username and send friend requests
- **Friend request confirmation** — manual approve/decline, or **auto-approve** with pre-set credentials
- **Credential-based auto-approve** — requester must provide correct credential phrase
- **Group chats** with member management and role assignments
- **Invite links** for easy group joining

### 🏅 Sponsor Role System
| Role | Badge | Color | Level |
|------|-------|-------|-------|
| General Sponsor | GS | Silver #95a5a6 | 1 |
| Senior Sponsor | SS | Gold #f1c40f | 2 |
| Core Sponsor | CS | Orange #e67e22 | 3 |
| Sole Exclusive Sponsor | SES | Purple #9b59b6 | 4 |
| Reserve Fund Sponsor | RFS | Red #e74c3c | 5 |

- Roles are visible on user profiles, chat messages, and group member lists
- Group admins can assign/change roles for members

### ✈️ Sponsor Flying Effects
When a sponsor is active, their badge flies across chat windows with particle effects. Frequency depends on sponsor level and viewer's own level. Click a flying sponsor to add them as friend.

| Viewer Role | Can See Levels |
|------------|---------------|
| None | 1-5 (all) |
| General (1) | 2-5 |
| Senior (2) | 3-5 |
| Core (3) | 4-5 |
| Sole Exclusive (4) | 5 |
| Reserve Fund (5) | None |

### 🔄 Multi-Version Support
Multiple sechat versions run simultaneously sharing data. The bot tracks adoption and auto-deprecates old versions.

### 🔄 Account Merging
- **Merge two accounts** to share chat history
- **Both usernames** can log in after merge
- **Simultaneous online** support — both accounts active at the same time
- **Merge codes** — one-time codes valid for 5 minutes

### 📁 Media Sharing
- **Send images** with inline preview, tap to expand fullscreen
- **Send videos** with play overlay and duration badge
- **Send files** of any type with name, size, and download button
- **Built-in camera** capture support
- **All media encrypted** end-to-end with security badges

### 📞 Voice Calls
- Full-screen voice call UI with Signal-inspired design
- Call states: Calling → Ringing → Connected → Ended
- Mute toggle, Speaker toggle, End Call button
- Animated call timer and pulsing avatar during ringing
- End-to-end encrypted call indicator

### 📱 iPhone PWA Support
- display: standalone — full-screen app experience
- apple-mobile-web-app-capable — iOS home screen installable
- iOS safe area insets (env(safe-area-inset-top))
- Touch callout and selection prevention
- Offline-capable via service worker

### ⚙️ Security Settings
- **Three security levels**: Standard / High / Maximum
- **Screenshot protection** toggle
- **WebGPU anti-capture** toggle
- **Self-destruct timer**: 10s / 30s / 1min / 5min / 1hour
- **Biometric lock** ready for iOS native integration
- **Security dashboard** showing encryption status, public key, and protection features

---

## 🏗️ Architecture



---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Modern browser with WebGPU support (Safari 16.4+, Chrome 113+)
- iOS 16.4+ for full PWA experience

### Installation



### iPhone Installation
1. Open Safari and navigate to the app URL
2. Tap the **Share** button
3. Tap **Add to Home Screen**
4. Tap **Add**

---

## 🔒 Security Summary

| Protection | Technology | Status |
|-----------|-----------|--------|
| Message encryption | ECDH + AES-256-GCM (Signal Protocol) | ✅ Active |
| Key exchange | X3DH with perfect forward secrecy | ✅ Active |
| Screenshot detection | Visibility API, blur events, keyboard shortcuts | ✅ Active |
| Auto-blur on capture | CSS filter: blur(24px) brightness(0.2) | ✅ Active |
| Screen recording protection | WebGPU temporal noise + frame drop monitoring | ✅ Active |
| Camera photo protection | Moiré pattern + light sensor + orientation analysis | ✅ Active |
| Authentication | WebAuthn (Face ID/Touch ID) + TOTP (MS Authenticator) | ✅ Active |
| Registration lock | 5-minute timer with auto-release | ✅ Active |
| PWA security | Standalone mode, iOS safe areas, CSP headers | ✅ Active |

---

## 📊 Technical Stats

- **Modules**: 68
- **TypeScript**: Zero compilation errors
- **CSS**: 14.73 kB (gzip: 3.26 kB)
- **JavaScript**: 266.49 kB (gzip: 79.43 kB)
- **Build time**: ~1.2s (Vite 5)

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- Inspired by [Signal](https://signal.org/) design philosophy
- WebGPU compute shaders for real-time protection
- WebAuthn and Web Crypto API for passwordless security


---

<br>

# SeChat — 安全通讯工具

> *无密码. 私密. 受保护.*

**SeChat** 是一款专为 iPhone 用户设计的端到端加密安全通讯应用。它将 **Signal 协议**加密与 **WebGPU** 硬件加速的防截图和防录像保护相结合，构建真正安全的通讯平台。

---

## ✨ 功能特性

### 🔐 端到端加密 (Signal 协议)
- **ECDH P-256** 密钥协商 + **AES-256-GCM** 加密
- **X3DH** (扩展三方迪菲-赫尔曼) 密钥交换协议
- **完美前向保密 (PFS)** — 泄露密钥无法解密历史消息
- **双棘轮算法** 持续密钥轮换
- 每条消息传输前均加密

### 🛡️ 防截图 & 防录像 (WebGPU)
- **WebGPU 计算着色器** 施加人眼不可见但干扰摄像头和录屏的动态噪声
- **摩尔纹生成** 干扰屏幕翻拍
- **时间噪声** 每帧变化，使视频录制无法使用
- **水印覆盖** SeChat PROTECTED 微妙渲染
- **环境光监测** 检测相机闪光灯/对焦辅助灯
- **设备朝向分析** 检测设备平放（外部相机拍摄）
- **性能监控** 通过帧率下降分析检测屏幕录制
- **截图自动模糊** — 检测后 blur(24px) brightness(0.2)，红色警告覆盖

### 🔑 无密码认证
- **WebAuthn** (Web 认证 API) — Face ID, Touch ID, Windows Hello
- **Microsoft Authenticator** 降级方案 — **TOTP** (RFC 6238, 30秒窗口, 6位码)
- **随机用户名生成** — User_X7k3M9 风格，无需密码
- **5分钟注册锁定** — 用户名在注册期间预留，超时自动释放
- **用户名唯一性** — 注册后不可再次使用

### 👥 好友 & 群组系统
- **按用户名搜索** 用户并发送好友请求
- **好友请求确认** — 手动接受/拒绝，或自动通过（预设凭证）
- **凭证验证** — 请求方必须提供正确的凭证短语才能自动通过
- **群聊** 含成员管理和角色分配
- **邀请链接** 方便加入群组

### 🏅 赞助商角色系统
| 角色 | 徽标 | 颜色 | 等级 |
|------|------|------|------|
| General Sponsor | GS | 银灰 #95a5a6 | 1 |
| Senior Sponsor | SS | 金色 #f1c40f | 2 |
| Core Sponsor | CS | 橙色 #e67e22 | 3 |
| Sole Exclusive Sponsor | SES | 紫色 #9b59b6 | 4 |
| Reserve Fund Sponsor | RFS | 红色 #e74c3c | 5 |

- 角色在用户资料、聊天消息和群成员列表中可见
- 群管理员可为成员分配/更改角色

### 🔄 账户合并
- **合并两个账户** 共享聊天记录
- **两个用户名** 合并后均可登录
- **同时在线** 支持 — 两个账户同时活动
- **合并码** — 一次性码，5分钟有效

### 📁 媒体分享
- **发送图片** 内联预览，点击全屏展开
- **发送视频** 播放叠加层 + 时长标签
- **发送文件** 任意类型，显示名称、大小和下载按钮
- **内置相机** 拍照支持
- **所有媒体端到端加密**，带安全徽标

### 📞 语音通话
- 全屏语音通话 UI，Signal 风格设计
- 通话状态：呼叫中 → 响铃 → 已连接 → 已结束
- 静音切换、扬声器切换、挂断按钮
- 动画通话计时器和响铃时脉冲头像
- 端到端加密通话指示

### 📱 iPhone PWA 支持
- display: standalone — 全屏应用体验
- apple-mobile-web-app-capable — 可安装到 iOS 主屏幕
- iOS 安全区域适配 (env(safe-area-inset-top))
- 禁止触摸呼出和选择
- 通过 Service Worker 支持离线

### ⚙️ 安全设置
- **三级安全级别**：标准 / 高 / 最高
- **截图保护** 开关
- **WebGPU 防截图** 开关
- **自毁定时器**：10秒 / 30秒 / 1分钟 / 5分钟 / 1小时
- **生物识别锁** 为 iOS 原生集成准备
- **安全仪表板** 显示加密状态、公钥和保护功能
---

## 🚀 快速开始

### 前提条件
- Node.js 18+ 和 npm
- 支持 WebGPU 的现代浏览器 (Safari 16.4+, Chrome 113+)
- iOS 16.4+ 以获得完整 PWA 体验

### 安装

### iPhone 安装
1. 打开 Safari 访问应用地址
2. 点击分享按钮
3. 点击添加到主屏幕
4. 点击添加

## 🔒 安全摘要

| 保护措施 | 技术 | 状态 |
|---------|------|------|
| 消息加密 | ECDH + AES-256-GCM (Signal 协议) | ✅ 激活 |
| 密钥交换 | X3DH 完美前向保密 | ✅ 激活 |
| 截图检测 | Visibility API、模糊事件、快捷键 | ✅ 激活 |
| 截图自动模糊 | CSS filter: blur(24px) brightness(0.2) | ✅ 激活 |
| 屏幕录制保护 | WebGPU 时间噪声 + 帧率监控 | ✅ 激活 |
| 拍照保护 | 摩尔纹 + 光线传感器 + 朝向分析 | ✅ 激活 |
| 认证 | WebAuthn (Face ID/Touch ID) + TOTP (MS Authenticator) | ✅ 激活 |
| 注册锁定 | 5分钟计时器自动释放 | ✅ 激活 |
| PWA 安全 | Standalone 模式、iOS 安全区域、CSP 头 | ✅ 激活 |

## 📊 技术数据
- **模块数**: 68
- **TypeScript**: 零编译错误
- **CSS**: 14.73 kB (gzip: 3.26 kB)
- **JavaScript**: 266.49 kB (gzip: 79.43 kB)
- **构建时间**: ~1.2s (Vite 5)

## 📄 开源协议
MIT

## 🙏 致谢
- 灵感来自 Signal 的设计理念
- WebGPU 计算着色器提供实时保护
- WebAuthn 和 Web Crypto API 实现无密码安全
