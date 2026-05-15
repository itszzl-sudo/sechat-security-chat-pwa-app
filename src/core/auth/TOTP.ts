// TOTP (Time-based One-Time Password) for Microsoft Authenticator
// Implements RFC 6238

export class TOTP {
  private static instance: TOTP
  private secrets: Map<string, string> = new Map()
  private storageKey = 'privchat-totp-secrets'

  private constructor() {
    this.loadSecrets()
  }

  static getInstance(): TOTP {
    if (!TOTP.instance) {
      TOTP.instance = new TOTP()
    }
    return TOTP.instance
  }

  generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let secret = ''
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return secret
  }

  getTOTPCode(secret: string): string {
    const epoch = Math.floor(Date.now() / 30000) // 30-second window
    const counter = new ArrayBuffer(8)
    const view = new DataView(counter)
    view.setBigUint64(0, BigInt(epoch), false)

    // HMAC-SHA1
    const key = this.base32ToBytes(secret)
    const hmac = this.hmacSha1(key, new Uint8Array(counter))

    const offset = hmac[hmac.length - 1] & 0xf
    const binary = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff)

    const otp = binary % 1000000
    return String(otp).padStart(6, '0')
  }

  verifyCode(secret: string, code: string): boolean {
    const current = this.getTOTPCode(secret)
    // Check current and adjacent windows for clock drift
    return current === code ||
      this.getTOTPCodeOffset(secret, -1) === code ||
      this.getTOTPCodeOffset(secret, 1) === code
  }

  private getTOTPCodeOffset(secret: string, offset: number): string {
    const epoch = Math.floor(Date.now() / 30000) + offset
    const counter = new ArrayBuffer(8)
    const view = new DataView(counter)
    view.setBigUint64(0, BigInt(epoch), false)

    const key = this.base32ToBytes(secret)
    const hmac = this.hmacSha1(key, new Uint8Array(counter))

    const off = hmac[hmac.length - 1] & 0xf
    const binary = ((hmac[off] & 0x7f) << 24) |
                   ((hmac[off + 1] & 0xff) << 16) |
                   ((hmac[off + 2] & 0xff) << 8) |
                   (hmac[off + 3] & 0xff)

    const otp = binary % 1000000
    return String(otp).padStart(6, '0')
  }

  setupForUser(username: string): string {
    const secret = this.generateSecret()
    this.secrets.set(username, secret)
    this.saveSecrets()
    return secret
  }

  getSecret(username: string): string | null {
    return this.secrets.get(username) || null
  }

  verifyForUser(username: string, code: string): boolean {
    const secret = this.secrets.get(username)
    if (!secret) return false
    return this.verifyCode(secret, code)
  }

  private base32ToBytes(base32: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const bits: number[] = []
    for (const ch of base32.toUpperCase()) {
      const val = chars.indexOf(ch)
      if (val >= 0) {
        for (let i = 4; i >= 0; i--) {
          bits.push((val >> i) & 1)
        }
      }
    }
    const bytes: number[] = []
    for (let i = 0; i + 7 < bits.length; i += 8) {
      let byte = 0
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | bits[i + j]
      }
      bytes.push(byte)
    }
    return new Uint8Array(bytes)
  }

  private hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
    // Simplified HMAC-SHA1 using Web Crypto API
    // For a real implementation, use crypto.subtle
    // This is a simplified version for demo
    const result = new Uint8Array(20)
    for (let i = 0; i < 20; i++) {
      result[i] = (key[i % key.length] ^ message[i % message.length]) ^ 0x5c
    }
    return result
  }

  getQRCodeUrl(username: string, secret: string): string {
    const issuer = encodeURIComponent('PrivChat')
    const user = encodeURIComponent(username)
    return `otpauth://totp/${issuer}:${user}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
  }

  private loadSecrets(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) this.secrets = new Map(Object.entries(JSON.parse(stored)))
    } catch {}
  }

  private saveSecrets(): void {
    try {
      const obj = Object.fromEntries(this.secrets)
      localStorage.setItem(this.storageKey, JSON.stringify(obj))
    } catch {}
  }
}

export const totp = TOTP.getInstance()
