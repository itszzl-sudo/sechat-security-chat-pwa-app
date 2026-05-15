export class SignalProtocol {
  private identityKey: CryptoKeyPair | null = null
  private preKeys: Map<string, CryptoKeyPair> = new Map()
  private static instance: SignalProtocol

  private constructor() {}

  static getInstance(): SignalProtocol {
    if (!SignalProtocol.instance) {
      SignalProtocol.instance = new SignalProtocol()
    }
    return SignalProtocol.instance
  }

  async initialize(): Promise<void> {
    this.identityKey = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    )
    for (let i = 0; i < 10; i++) {
      const preKey = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      )
      this.preKeys.set('prekey_' + i, preKey)
    }
  }

  async getPublicKey(): Promise<JsonWebKey | null> {
    if (!this.identityKey?.publicKey) return null
    return await crypto.subtle.exportKey('jwk', this.identityKey.publicKey)
  }

  async encrypt(message: string, recipientPublicKey: JsonWebKey): Promise<{ ciphertext: string; iv: string }> {
    const sharedSecret = await this.deriveSharedSecret(recipientPublicKey)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(message)
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedSecret,
      encoded
    )
    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    }
  }

  async decrypt(ciphertext: string, iv: string, senderPublicKey: JsonWebKey): Promise<string> {
    const sharedSecret = await this.deriveSharedSecret(senderPublicKey)
    const encrypted = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      sharedSecret,
      encrypted
    )
    return new TextDecoder().decode(decrypted)
  }

  private async deriveSharedSecret(peerPublicKey: JsonWebKey): Promise<CryptoKey> {
    if (!this.identityKey?.privateKey) throw new Error('Not initialized')
    const peerKey = await crypto.subtle.importKey(
      'jwk', peerPublicKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      true, []
    )
    return await crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerKey },
      this.identityKey.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }
}

export const signalProtocol = SignalProtocol.getInstance()
