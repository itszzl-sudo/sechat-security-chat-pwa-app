import { useState } from 'react'
import { useStore } from '../store/useStore'

interface Props {
  onClose: () => void
}

export default function MergeAccounts({ onClose }: Props) {
  const [mergeCode, setMergeCode] = useState('')
  const [message, setMessage] = useState('')
  const [showCode, setShowCode] = useState(false)

  const generateMergeCode = useStore(s => s.generateMergeCode)
  const mergeAccounts = useStore(s => s.mergeAccounts)
  const getAccountUsernames = useStore(s => s.getAccountUsernames)
  const currentUser = useStore(s => s.currentUser)

  const handleGenerateCode = () => {
    const code = generateMergeCode()
    setMergeCode(code)
    setShowCode(true)
    setMessage('Share this code with the account you want to merge with.')
  }

  const handleMerge = () => {
    if (!mergeCode.trim()) {
      setMessage('Please enter a merge code')
      return
    }
    const success = mergeAccounts(mergeCode.trim())
    if (success) {
      setMessage('✅ Accounts merged successfully! Both usernames can now log in.')
    } else {
      setMessage('❌ Invalid code or merge failed.')
    }
  }

  const linkedAccounts = getAccountUsernames()
  const hasMerged = linkedAccounts.length > 1

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10000
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', borderRadius: 16, padding: 24,
        maxWidth: 400, width: '90%', border: '1px solid var(--border)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: '#e8e8e8' }}>{'🔄'} Merge Accounts</h3>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          Merge two accounts to share chat history and allow both usernames to log in simultaneously.
        </div>

        {/* Current linked accounts */}
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

        {/* Generate merge code */}
        {!showCode && (
          <button onClick={handleGenerateCode}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 600,
              fontSize: 14, cursor: 'pointer', marginBottom: 12
            }}>
            {'🔗'} Generate Merge Code
          </button>
        )}

        {/* Display merge code */}
        {showCode && mergeCode && (
          <div style={{
            padding: 12, background: '#0d0d1a', borderRadius: 8,
            marginBottom: 12, textAlign: 'center'
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Your merge code:</div>
            <div style={{
              fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
              color: 'var(--accent)', letterSpacing: 2
            }}>{mergeCode}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              This code expires in 5 minutes
            </div>
          </div>
        )}

        {/* Enter merge code */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="input-field" type="text"
            placeholder="Enter merge code from other account"
            value={mergeCode} onChange={e => setMergeCode(e.target.value)}
            style={{ flex: 1, fontSize: 13 }} />
        </div>
        <button onClick={handleMerge}
          style={{
            width: '100%', padding: 12, borderRadius: 8, border: 'none',
            background: 'var(--success)', color: '#fff', fontWeight: 600,
            fontSize: 14, cursor: 'pointer', marginBottom: 12
          }}>
          {'🔄'} Merge Accounts
        </button>

        {message && (
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            background: message.startsWith('✅') ? 'rgba(0, 184, 148, 0.1)' :
                         message.startsWith('❌') ? 'rgba(233, 69, 96, 0.1)' :
                         'rgba(45, 156, 219, 0.08)',
            color: message.startsWith('✅') ? 'var(--success)' :
                   message.startsWith('❌') ? 'var(--danger)' : 'var(--accent)',
            fontSize: 12, textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <button onClick={onClose} style={{
          marginTop: 16, background: 'none', border: 'none',
          color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
          width: '100%', textAlign: 'center'
        }}>Close</button>
      </div>
    </div>
  )
}
