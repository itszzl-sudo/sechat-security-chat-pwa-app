import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { keyManager } from '../core/crypto/KeyManager'
import RoleBadge from '../components/RoleBadge'

export default function AuthPage() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const registerUser = useStore(s => s.registerUser)
  const currentUser = useStore(s => s.currentUser)
  const isAuthenticated = useStore(s => s.isAuthenticated)

  if (isAuthenticated) {
    navigate('/chats', { replace: true })
    return null
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !displayName.trim()) {
      setError('Please fill in all fields')
      return
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    setIsLoading(true)
    try {
      await keyManager.generateKeyPair()
      await new Promise(resolve => setTimeout(resolve, 1000))
      registerUser(username.trim(), displayName.trim())
      navigate('/chats', { replace: true })
    } catch (err) {
      setError('Registration failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-logo">🔒</div>
      <h1 className="auth-title">PrivChat</h1>
      <p className="auth-subtitle">
        Secure messaging with end-to-end encryption powered by Signal Protocol.
        Your conversations stay private — always.
      </p>

      <form className="auth-form" onSubmit={handleRegister}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Username</label>
          <input className="input-field" type="text" placeholder="Choose a username"
            value={username} onChange={e => setUsername(e.target.value)}
            autoComplete="username" autoFocus maxLength={30} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Display Name</label>
          <input className="input-field" type="text" placeholder="Your display name"
            value={displayName} onChange={e => setDisplayName(e.target.value)}
            autoComplete="name" maxLength={50} />
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>{error}</div>}
        <button className="btn-primary" type="submit" disabled={isLoading}
          style={{ opacity: isLoading ? 0.7 : 1 }}>
          {isLoading ? '🔐 Creating secure account...' : '🔐 Start Secure Chat'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          <span className="badge encrypted">🔐 End-to-End Encrypted</span>
          <span className="badge verified">✓ Signal Protocol</span>
        </div>
      </form>

      <div style={{ marginTop: 'auto', textAlign: 'center', padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {currentUser?.sponsorRole && currentUser?.sponsorRole !== 'none' && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏅 Sponsor: </span>
              <RoleBadge role={currentUser.sponsorRole as any} size="medium" showLabel={true} />
            </div>
          )}
          <div>🛡️ Anti-screenshot protection • ⚡ WebGPU hardware security</div>
          <div>📱 PWA enabled • Works offline • 📸 Screenshot auto-blur</div>
        </div>
      </div>
    </div>
  )
}
