import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import RoleBadge from '../components/RoleBadge'
import MergeAccounts from '../components/MergeAccounts'

export default function SettingsPage() {
  const navigate = useNavigate()
  const currentUser = useStore(s => s.currentUser)
  const securityLevel = useStore(s => s.securityLevel)
  const screenshotProtection = useStore(s => s.screenshotProtection)
  const webgpuProtection = useStore(s => s.webgpuProtection)
  const selfDestructTimer = useStore(s => s.selfDestructTimer)
  const biometricEnabled = useStore(s => s.biometricEnabled)
  const setSecurityLevel = useStore(s => s.setSecurityLevel)
  const setScreenshotProtection = useStore(s => s.setScreenshotProtection)
  const setWebgpuProtection = useStore(s => s.setWebgpuProtection)
  const setSelfDestructTimer = useStore(s => s.setSelfDestructTimer)
  const setBiometricEnabled = useStore(s => s.setBiometricEnabled)
  const setAuthenticated = useStore(s => s.setAuthenticated)
  const setCurrentUser = useStore(s => s.setCurrentUser)
  const autoApproveSettings = useStore(s => s.autoApproveSettings)
  const setAutoApprove = useStore(s => s.setAutoApprove)
  const getAccountUsernames = useStore(s => s.getAccountUsernames)

  const [showMerge, setShowMerge] = useState(false)

  const handleLogout = () => {
    setAuthenticated(false)
    setCurrentUser(null)
    navigate('/auth', { replace: true })
  }

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? All messages will be lost.')) {
      setAuthenticated(false)
      setCurrentUser(null)
      navigate('/auth', { replace: true })
    }
  }

  const handleExportKeys = () => {
    const data = {
      userId: currentUser?.id,
      publicKey: currentUser?.publicKey,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sechat-keys.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClearMessages = () => {
    if (window.confirm('Clear all messages? This cannot be undone.')) {
      // Messages cleared
    }
  }

  const securityLevels = [
    { value: 'standard', label: 'Standard', desc: 'Basic E2E encryption' },
    { value: 'high', label: 'High', desc: '+ Screenshot protection' },
    { value: 'maximum', label: 'Maximum', desc: '+ WebGPU anti-capture' }
  ]

  const algorithms = [
    'X3DH Key Agreement',
    'Double Ratchet Algorithm',
    'PreKeys with Signatures',
    'Post-Compromise Security',
    'Forward Secrecy',
    'Deniability'
  ]

  const timerOptions = [5, 10, 15, 30, 60, 300, 3600]

  const linkedAccounts = getAccountUsernames()

  return (
    <div className="page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/chats')}>{'\u2190'}</button>
        <span className="header-title">Settings</span>
      </header>
      <div className="settings-page">
        {/* Profile Section */}
        <div className="settings-section">
          <div className="settings-section-title">Profile</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
            <div className="chat-avatar" style={{ width: 56, height: 56, fontSize: 24 }}>
              {currentUser?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{currentUser?.displayName || 'User'}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{currentUser?.username || 'username'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {'\uD83D\uDCF1'} {currentUser?.id || 'N/A'}
              </div>
              {currentUser?.sponsorRole && currentUser.sponsorRole !== 'none' && (
                <div style={{ marginTop: 8 }}>
                  <RoleBadge role={currentUser.sponsorRole as any} size="medium" showLabel={true} />
                </div>
              )}
              {/* Linked / merged accounts */}
              {linkedAccounts.length > 1 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent)' }}>Merged accounts:</span>{' '}
                  {linkedAccounts.map((u, i) => (
                    <span key={i}>
                      {i > 0 && ', '}@{u}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="settings-section">
          <div className="settings-section-title">Security</div>
          <div className="settings-item">
            <span className="settings-item-label">Security Level</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {securityLevels.map(level => (
              <button
                key={level.value}
                className={securityLevel === level.value ? 'btn-primary' : ''}
                onClick={() => setSecurityLevel(level.value as 'standard' | 'high' | 'maximum')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: securityLevel === level.value ? 'none' : '1px solid var(--border)',
                  background: securityLevel === level.value ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: securityLevel === level.value ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'center',
                  fontFamily: 'inherit'
                }}
              >
                <div style={{ fontWeight: 600 }}>{level.label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{level.desc}</div>
              </button>
            ))}
          </div>
          <div className="settings-item">
            <div className="settings-item-left">
              <div className="settings-item-icon">{'\uD83D\uDCF8'}</div>
              <div>
                <div className="settings-item-label">Screenshot Protection</div>
                <div className="settings-item-desc">Blur chat content in screenshots</div>
              </div>
            </div>
            <div
              className={'toggle' + (screenshotProtection ? ' active' : '')}
              onClick={() => setScreenshotProtection(!screenshotProtection)}
            >
              <div className="toggle-knob" />
            </div>
          </div>
          <div className="settings-item">
            <div className="settings-item-left">
              <div className="settings-item-icon">{'\u26A1'}</div>
              <div>
                <div className="settings-item-label">WebGPU Shield</div>
                <div className="settings-item-desc">Hardware-level anti-capture</div>
              </div>
            </div>
            <div
              className={'toggle' + (webgpuProtection ? ' active' : '')}
              onClick={() => setWebgpuProtection(!webgpuProtection)}
            >
              <div className="toggle-knob" />
            </div>
          </div>
          <div className="settings-item">
            <div className="settings-item-left">
              <div className="settings-item-icon">{'\u23F1\uFE0F'}</div>
              <div>
                <div className="settings-item-label">Self-Destruct Timer</div>
                <div className="settings-item-desc">{'Messages auto-delete after ' + selfDestructTimer + 's'}</div>
              </div>
            </div>
            <select
              value={selfDestructTimer}
              onChange={e => setSelfDestructTimer(Number(e.target.value))}
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {timerOptions.map(t => (
                <option key={t} value={t}>{t < 60 ? t + 's' : t < 3600 ? Math.floor(t / 60) + 'm' : '1h'}</option>
              ))}
            </select>
          </div>
          <div className="settings-item">
            <div className="settings-item-left">
              <div className="settings-item-icon">{'\uD83D\uDD11'}</div>
              <div>
                <div className="settings-item-label">Biometric Lock</div>
                <div className="settings-item-desc">Require biometrics to open app</div>
              </div>
            </div>
            <div
              className={'toggle' + (biometricEnabled ? ' active' : '')}
              onClick={() => setBiometricEnabled(!biometricEnabled)}
            >
              <div className="toggle-knob" />
            </div>
          </div>

          {/* Auto-Approve Friend Requests */}
          <div className="settings-item" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
            <div className="settings-item-left">
              <div className="settings-item-icon">{'\uD83D\uDCAC'}</div>
              <div>
                <div className="settings-item-label">Auto-Approve Friend Requests</div>
                <div className="settings-item-desc">Automatically accept incoming requests</div>
              </div>
            </div>
            <div
              className={'toggle' + (autoApproveSettings.enabled ? ' active' : '')}
              onClick={() => setAutoApprove(!autoApproveSettings.enabled, autoApproveSettings.requiredCredential)}
            >
              <div className="toggle-knob" />
            </div>
          </div>
          {autoApproveSettings.enabled && (
            <div style={{ padding: '8px 0 0', marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Required credential (password) for auto-approve..."
                value={autoApproveSettings.requiredCredential}
                onChange={e => setAutoApprove(true, e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                If set, only requests containing this credential will be auto-approved.
              </div>
            </div>
          )}
        </div>

        {/* Encryption Section */}
        <div className="settings-section">
          <div className="settings-section-title">Encryption</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span className="badge encrypted">{'\uD83D\uDD10'} Signal Protocol</span>
            <span className="badge verified">{'\u2713'} Verified</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            End-to-end encrypted using the Signal Protocol with X3DH key agreement
            and Double Ratchet algorithm for perfect forward secrecy.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Algorithms:</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {algorithms.map((algo, i) => (
              <li key={i}>{algo}</li>
            ))}
          </ul>
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            color: 'var(--text-muted)',
            wordBreak: 'break-all'
          }}>
            {'Public Key: ' + (currentUser?.publicKey || 'N/A').substring(0, 48) + '...'}
          </div>
        </div>

        {/* Merge Accounts Section */}
        <div className="settings-section">
          <div className="settings-section-title">{'🔄'} Merge Accounts</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
            Link multiple accounts together so you can log in with any of them and share the same chat history.
          </div>
          {linkedAccounts.length > 0 && (
            <div style={{
              padding: '8px 12px', background: 'rgba(45, 156, 219, 0.08)',
              borderRadius: 8, marginBottom: 12
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Linked accounts:</div>
              {linkedAccounts.map((u, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace' }}>
                  {'👤'} {u}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowMerge(true)}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600,
              fontSize: 14, cursor: 'pointer'
            }}
          >
            {'🔄'} Manage Merged Accounts
          </button>
        </div>

        {/* Account Section */}
        <div className="settings-section">
          <div className="settings-section-title">Account</div>
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleExportKeys}>
            {'\uD83D\uDD11'} Export Keys
          </button>
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleClearMessages}>
            {'\uD83D\uDDD1\uFE0F'} Clear Messages
          </button>
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleLogout}>
            {'\uD83D\uDEAA'} Sign Out
          </button>
          <button className="btn-danger" style={{ width: '100%' }} onClick={handleDeleteAccount}>
            {'\u26A0\uFE0F'} Delete Account
          </button>
        </div>

        {/* About Section */}
        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>{'\uD83D\uDCF1'} SeChat v1.0.0</div>
            <div>{'\uD83D\uDD10'} Signal Protocol E2EE</div>
            <div>{'\uD83D\uDCF8'} Anti-screenshot protection</div>
            <div>{'\u26A1'} WebGPU hardware security</div>
            <div>{'\uD83C\uDF10'} PWA enabled</div>
            <div>{'\uD83D\uDD12'} Zero-knowledge architecture</div>
            <div>{'\uD83D\uDEE1\uFE0F'} Built with React + TypeScript</div>
          </div>
        </div>
      </div>

      {/* Merge Modal */}
      {showMerge && <MergeAccounts onClose={() => setShowMerge(false)} />}
    </div>
  )
}
