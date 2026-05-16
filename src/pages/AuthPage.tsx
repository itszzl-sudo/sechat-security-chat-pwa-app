import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { keyManager } from '../core/crypto/KeyManager'
import { webAuthnAuth } from '../core/auth/WebAuthn'
import { totp } from '../core/auth/TOTP'
import RoleBadge from '../components/RoleBadge'

export default function AuthPage() {
  const navigate = useNavigate()
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const currentUser = useStore(s => s.currentUser)

  // Registration state from store
  const registrationStep = useStore(s => s.registrationStep)
  const currentUsername = useStore(s => s.currentUsername)
  const registrationTimer = useStore(s => s.registrationTimer)
  const totpSecret = useStore(s => s.totpSecret)
  const totpQRUrl = useStore(s => s.totpQRUrl)
  const isWebAuthnAvailable = useStore(s => s.isWebAuthnAvailable)

  // Actions
  const startRegistration = useStore(s => s.startRegistration)
  const attemptWebAuthnRegister = useStore(s => s.attemptWebAuthnRegister)
  const attemptWebAuthnLogin = useStore(s => s.attemptWebAuthnLogin)
  const setupTOTP = useStore(s => s.setupTOTP)
  const verifyTOTPAndRegister = useStore(s => s.verifyTOTPAndRegister)
  const completeRegistration = useStore(s => s.completeRegistration)
  const loginUser = useStore(s => s.loginUser)
  const cancelRegistration = useStore(s => s.cancelRegistration)
  const tickRegistrationTimer = useStore(s => s.tickRegistrationTimer)

  const [displayName, setDisplayName] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const timerRef = useRef<number>(0)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate('/chats', { replace: true })
  }, [isAuthenticated, navigate])

  // Registration timer countdown
  useEffect(() => {
    if (registrationStep === 'webauthn' || registrationStep === 'totp') {
      timerRef.current = window.setInterval(() => {
        tickRegistrationTimer()
      }, 1000)
    }
    return () => { clearInterval(timerRef.current) }
  }, [registrationStep, tickRegistrationTimer])

  // Auto-start registration on mount
  useEffect(() => {
    if (!isAuthenticated && registrationStep === 'generating') {
      startRegistration()
    }
  }, [])

  const handleBeginWebAuthn = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const username = currentUsername || (await startRegistration())
      await keyManager.generateKeyPair()
      const success = await attemptWebAuthnRegister(username, displayName.trim())
      if (success) navigate('/chats', { replace: true })
      else setError('WebAuthn failed. Try TOTP instead.')
    } catch (err) {
      setError('Registration failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetupTOTP = () => {
    if (!displayName.trim()) {
      setError('Please enter a display name')
      return
    }
    const username = currentUsername || ''
    const secret = setupTOTP(username)
    setIsLoading(true)
    setError('')
  }

  const handleVerifyTOTP = async () => {
    if (!totpCode.trim() || totpCode.length < 6) {
      setError('Please enter a valid 6-digit code')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await keyManager.generateKeyPair()
      const success = verifyTOTPAndRegister(currentUsername || '', displayName.trim(), totpCode.trim())
      if (success) navigate('/chats', { replace: true })
      else setError('Invalid code. Try again.')
    } catch (err) {
      setError('Verification failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!loginUsername.trim()) {
      setError('Please enter your username')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      // First try WebAuthn
      const webAuthnSuccess = await loginUser(loginUsername.trim())
      if (webAuthnSuccess) {
        // loginUser already performed WebAuthn assertion internally
        navigate('/chats', { replace: true })
      } else {
        // WebAuthn failed or user not found - check if user exists for TOTP fallback
        const totpSecret = totp.getSecret(loginUsername.trim())
        if (totpSecret) {
          setError('Please enter your TOTP code from Microsoft Authenticator')
          setLoginUsername(loginUsername.trim())
        } else {
          setError('Username not found or no authentication method available')
        }
      }
    } catch (err) {
      setError('Login failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleTOTPLogin = async () => {
    if (!totpCode.trim() || totpCode.length < 6) {
      setError('Please enter a valid 6-digit code')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const success = totp.verifyForUser(loginUsername, totpCode.trim())
      if (success) {
        await loginUser(loginUsername)
        navigate('/chats', { replace: true })
      } else {
        setError('Invalid TOTP code')
      }
    } catch (err) {
      setError('Login failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m + ':' + String(s).padStart(2, '0')
  }

  return (
    <div className="page auth-page">
      <div className="auth-logo">{'\u{1F512}'}</div>
      <h1 className="auth-title">PrivChat</h1>
      <p className="auth-subtitle">
        Passwordless secure messaging with biometric authentication.
        Your identity is protected by WebAuthn or Microsoft Authenticator.
      </p>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setMode('register'); setError(''); cancelRegistration() }}
          style={{
            flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none',
            background: mode === 'register' ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer'
          }}>Register</button>
        <button onClick={() => { setMode('login'); setError('') }}
          style={{
            flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none',
            background: mode === 'login' ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer'
          }}>Login</button>
      </div>

      {mode === 'register' ? (
        <>{/* Registration Flow */}
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Random Username Display */}
            <div style={{
              padding: '12px 16px', background: 'rgba(45, 156, 219, 0.08)',
              borderRadius: 12, textAlign: 'center', border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Your random username
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                color: 'var(--accent)', letterSpacing: 1
              }}>
                {currentUsername || 'Generating...'}
              </div>
              {registrationTimer > 0 && (
                <div style={{
                  fontSize: 11, color: registrationTimer < 60 ? 'var(--danger)' : 'var(--text-muted)',
                  marginTop: 4
                }}>
                  {'\u23F1\uFE0F'} Locked for {formatTimer(registrationTimer)}
                </div>
              )}
            </div>

            {/* Display Name */}
            <input className="input-field" type="text"
              placeholder="Your display name (e.g., Alice)"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
              maxLength={50} autoFocus />

            {/* WebAuthn Registration */}
            {(registrationStep === 'generating' || registrationStep === 'webauthn') && (
              <>{isWebAuthnAvailable ? (
                  <button className="btn-primary" onClick={handleBeginWebAuthn}
                    disabled={isLoading || !displayName.trim()}
                    style={{ opacity: isLoading ? 0.7 : 1 }}>
                    {isLoading ? '\u23F3 Verifying identity...' : '\u{1F510} Register with Face ID / Touch ID'}
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {'\u{1F511}'} WebAuthn not available on this device.
                    <br />Using Microsoft Authenticator as fallback.
                  </div>
                )}
                <button onClick={() => {
                  if (displayName.trim()) handleSetupTOTP()
                  else setError('Please enter a display name first')
                }}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 8, padding: 10, color: 'var(--text-secondary)',
                    fontSize: 13, cursor: 'pointer', width: '100%'
                  }}>
                  {'\u{1F4F1}'} Use Microsoft Authenticator instead
                </button>
              </>
            )}

            {/* TOTP Setup */}
            {registrationStep === 'totp' && totpSecret && (
              <div>
                <div style={{
                  padding: 16, background: '#0d0d1a', borderRadius: 12,
                  textAlign: 'center', marginBottom: 12
                }}>
                  <div style={{ fontSize: 80, marginBottom: 8 }}>{'\u{1F4F1}'}</div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                    wordBreak: 'break-all', marginBottom: 8
                  }}>
                    Secret: {totpSecret}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {'\u{1F517}'} {totpQRUrl}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    1. Open Microsoft Authenticator<br />
                    2. Add account using this QR code or secret<br />
                    3. Enter the 6-digit code below
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input-field" type="text"
                    placeholder="000000"
                    value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, fontFamily: 'monospace' }}
                    maxLength={6} />
                </div>
                <button className="btn-primary" onClick={handleVerifyTOTP}
                  disabled={isLoading || totpCode.length < 6}
                  style={{ marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
                  {isLoading ? '\u23F3 Verifying...' : '\u2705 Verify & Complete Registration'}
                </button>
              </div>
            )}

            {/* Timer warning */}
            {registrationTimer > 0 && registrationTimer < 60 && (
              <div style={{
                padding: '8px 12px', background: 'rgba(233, 69, 96, 0.1)',
                borderRadius: 8, fontSize: 11, color: 'var(--danger)', textAlign: 'center'
              }}>
                {'\u26A0\uFE0F'} Username expires in {registrationTimer} seconds!
                Complete registration to keep it.
              </div>
            )}

            {/* Timer expired */}
            {registrationTimer <= 0 && registrationStep !== 'generating' && (
              <div style={{
                padding: '8px 12px', background: 'rgba(253, 203, 110, 0.1)',
                borderRadius: 8, fontSize: 11, color: 'var(--warning)', textAlign: 'center'
              }}>
                {'\u23F0'} Username expired. A new one will be generated.
                <button onClick={() => startRegistration()}
                  style={{
                    display: 'block', margin: '8px auto 0',
                    background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 4, padding: '4px 12px', fontSize: 11, cursor: 'pointer'
                  }}>Generate New Username</button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Login Mode */
        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input className="input-field" type="text"
            placeholder="Enter your username"
            value={loginUsername} onChange={e => setLoginUsername(e.target.value)}
            autoFocus />

          {!totpSecret ? (
            <button className="btn-primary" onClick={handleLogin}
              disabled={isLoading || !loginUsername.trim()}
              style={{ opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? '\u23F3 Authenticating...' : '\u{1F510} Login with Biometrics'}
            </button>
          ) : (
            <div>
              <input className="input-field" type="text"
                placeholder="Enter TOTP code from Microsoft Authenticator"
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, fontFamily: 'monospace' }}
                maxLength={6} />
              <button className="btn-primary" onClick={handleTOTPLogin}
                disabled={isLoading || totpCode.length < 6}
                style={{ marginTop: 8, opacity: isLoading ? 0.7 : 1 }}>
                {isLoading ? '\u23F3 Verifying...' : '\u2705 Verify & Login'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
          {error}
        </div>
      )}

      {/* Sponsor role display after registration */}
      {currentUser?.sponsorRole && currentUser?.sponsorRole !== 'none' && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{'\u{1F3C5}'} Sponsor: </span>
          <RoleBadge role={currentUser.sponsorRole as any} size="medium" showLabel={true} />
        </div>
      )}

      {/* Security footer */}
      <div style={{ marginTop: 'auto', textAlign: 'center', padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div>{'\u{1F6E1}\uFE0F'} Passwordless {'\u{1F510}'} WebAuthn + TOTP</div>
          <div>{'\u{1F464}'} sechat://domain/XXXXXXXX {'\u{1F512}'} 5-min registration lock</div>
          <div>{'\u{1F4F1}'} Microsoft Authenticator compatible</div>
        </div>
      </div>
    </div>
  )
}
