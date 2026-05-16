// WebAuthn passwordless authentication
// Uses platform authenticator (Face ID, Touch ID, Windows Hello)

export interface WebAuthnCredential {
  id: string
  rawId: string
  type: 'public-key'
  transports?: AuthenticatorTransport[]
  counter: number
}

export class WebAuthnAuth {
  private static instance: WebAuthnAuth
  private credentials: Map<string, WebAuthnCredential> = new Map()
  private storageKey = 'sechat-webauthn-credentials'

  private constructor() {
    this.loadCredentials()
  }

  static getInstance(): WebAuthnAuth {
    if (!WebAuthnAuth.instance) {
      WebAuthnAuth.instance = new WebAuthnAuth()
    }
    return WebAuthnAuth.instance
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           typeof window.PublicKeyCredential !== 'undefined' &&
           typeof navigator.credentials !== 'undefined'
  }

  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isAvailable()) return false
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      return available
    } catch {
      return false
    }
  }

  async register(username: string, displayName: string): Promise<boolean> {
    if (!this.isAvailable()) return false

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const userId = crypto.getRandomValues(new Uint8Array(16))

      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: 'SeChat', id: window.location.hostname },
        user: {
          id: userId,
          name: username,
          displayName: displayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      }

      const credential = await navigator.credentials.create({ publicKey })
      if (!credential) return false

      const cred = credential as PublicKeyCredential
      const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)))

      const webAuthnCred: WebAuthnCredential = {
        id: cred.id,
        rawId: credId,
        type: 'public-key',
        counter: 0,
      }

      this.credentials.set(username, webAuthnCred)
      this.saveCredentials()
      return true
    } catch (err) {
      console.warn('WebAuthn registration failed:', err)
      return false
    }
  }

  async login(username: string): Promise<boolean> {
    if (!this.isAvailable()) return false

    const storedCred = this.credentials.get(username)
    if (!storedCred) return false

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const rawId = Uint8Array.from(atob(storedCred.rawId), c => c.charCodeAt(0))

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
          id: rawId,
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      }

      const assertion = await navigator.credentials.get({ publicKey })
      if (!assertion) return false

      const cred = this.credentials.get(username)
      if (cred) {
        cred.counter++
        this.credentials.set(username, cred)
        this.saveCredentials()
      }
      return true
    } catch (err) {
      console.warn('WebAuthn login failed:', err)
      return false
    }
  }

  hasCredential(username: string): boolean {
    return this.credentials.has(username)
  }

  private loadCredentials(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.credentials = new Map(Object.entries(parsed))
      }
    } catch {}
  }

  private saveCredentials(): void {
    try {
      const obj = Object.fromEntries(this.credentials)
      localStorage.setItem(this.storageKey, JSON.stringify(obj))
    } catch {}
  }

  clearCredentials(): void {
    this.credentials.clear()
    localStorage.removeItem(this.storageKey)
  }
}

export const webAuthnAuth = WebAuthnAuth.getInstance()
