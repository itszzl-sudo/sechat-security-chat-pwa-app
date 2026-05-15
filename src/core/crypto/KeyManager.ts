import { signalProtocol } from './SignalProtocol'

export class KeyManager {
  private static instance: KeyManager
  private keyPair: CryptoKeyPair | null = null

  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager()
    }
    return KeyManager.instance
  }

  async generateKeyPair(): Promise<CryptoKeyPair> {
    this.keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
    return this.keyPair
  }

  async getPublicKeyJWK(): Promise<JsonWebKey | null> {
    if (!this.keyPair?.publicKey) return null
    return await crypto.subtle.exportKey('jwk', this.keyPair.publicKey)
  }

  async encryptMessage(message: string, recipientPublicKey: JsonWebKey): Promise<string> {
    const { ciphertext, iv } = await signalProtocol.encrypt(message, recipientPublicKey)
    return JSON.stringify({ ct: ciphertext, iv, version: 1 })
  }

  async decryptMessage(encryptedPackage: string, senderPublicKey: JsonWebKey): Promise<string> {
    const { ct, iv } = JSON.parse(encryptedPackage)
    return await signalProtocol.decrypt(ct, iv, senderPublicKey)
  }

  async hashPassword(password: string): Promise<string> {
    const encoded = new TextEncoder().encode(password)
    const hash = await crypto.subtle.digest('SHA-256', encoded)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

export const keyManager = KeyManager.getInstance()
