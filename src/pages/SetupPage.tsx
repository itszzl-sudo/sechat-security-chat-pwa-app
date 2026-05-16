import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

export default function SetupPage() {
  const navigate = useNavigate()
  const currentUser = useStore(s => s.currentUser)
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const registrationComplete = useStore(s => s.registrationComplete)
  const setDisplayName = useStore(s => s.setDisplayName)

  const [displayName, setDisplayNameLocal] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Redirect to auth if not properly authenticated via registration
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth', { replace: true })
    } else if (!registrationComplete) {
      // Already logged in normally, skip setup
      navigate('/chats', { replace: true })
    }
  }, [isAuthenticated, registrationComplete, navigate])

  const handleSave = () => {
    if (!currentUser) return

    setIsSaving(true)
    setError('')

    try {
      const name = displayName.trim() || 'User'
      setDisplayName(currentUser.username, name)
      navigate('/chats', { replace: true })
    } catch (err) {
      setError('Failed to save: ' + String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSkip = () => {
    if (!currentUser) return
    // Save with default "User" to clear the registrationComplete flag
    setDisplayName(currentUser.username, 'User')
    navigate('/chats', { replace: true })
  }

  if (!currentUser) return null

  return (
    <div className="page auth-page">
      <div className="auth-logo">{'\u{1F44B}'}</div>
      <h1 className="auth-title">Welcome to SeChat!</h1>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Username display */}
        <div style={{
          padding: '16px', background: 'rgba(45, 156, 219, 0.08)',
          borderRadius: 12, textAlign: 'center', border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Your unique username
          </div>
          <div style={{
            fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
            color: 'var(--accent)', letterSpacing: 0.5, wordBreak: 'break-all'
          }}>
            {currentUser.username}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
            background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6
          }}>
            {'\u{1F517}'} Share this with friends so they can find you
          </div>
        </div>

        {/* Display name input */}
        <div>
          <label style={{
            fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6
          }}>
            Display Name <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span>
          </label>
          <input
            className="input-field"
            type="text"
            placeholder="e.g. Alice"
            value={displayName}
            onChange={e => setDisplayNameLocal(e.target.value)}
            maxLength={50}
            autoFocus
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            You can skip this and set it later in Settings.
          </div>
        </div>

        {/* Warning about auto-delete */}
        <div style={{
          padding: '10px 14px', background: 'rgba(253, 203, 110, 0.08)',
          borderRadius: 8, border: '1px solid rgba(253, 203, 110, 0.2)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--warning)', lineHeight: 1.5 }}>
            {'\u26A0\uFE0F'} <strong>Note:</strong> If you don't set a display name
            and don't use the app within a week, your account will be automatically deleted.
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          style={{ opacity: isSaving ? 0.7 : 1 }}
        >
          {isSaving ? '\u23F3 Saving...' : '\u2705 Save & Continue'}
        </button>

        <button
          onClick={handleSkip}
          disabled={isSaving}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, padding: 10, color: 'var(--text-secondary)',
            fontSize: 13, cursor: 'pointer', width: '100%'
          }}
        >
          {'\u{1F6D1}'} Skip for now
        </button>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', textAlign: 'center', padding: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div>{'\u{1F6E1}\uFE0F'} Your identity is secure {'\u{1F510}'}</div>
          <div>{'\u{1F464}'} {currentUser.username}</div>
        </div>
      </div>
    </div>
  )
}
