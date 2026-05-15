import { useState } from 'react'
import { useStore, type SponsorRole } from '../store/useStore'

interface Props {
  groupId: string
  groupName: string
  onClose: () => void
}

export default function InviteLinkModal({ groupId, groupName, onClose }: Props) {
  const generateInviteLink = useStore(s => s.generateInviteLink)
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    const code = generateInviteLink(groupId)
    setLinkCode(code)
    setCopied(false)
  }

  const handleCopy = () => {
    if (linkCode) {
      const fullLink = window.location.origin + '/invite/' + linkCode
      navigator.clipboard.writeText(fullLink).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

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
        <h3 style={{ margin: '0 0 16px', color: '#e8e8e8' }}>
          {'📨'} Invite to {groupName}
        </h3>

        {!linkCode ? (
          <button onClick={handleGenerate} style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 8, padding: '12px 24px', fontSize: 15,
            fontWeight: 600, cursor: 'pointer', width: '100%'
          }}>
            {'🔗'} Generate Invite Link
          </button>
        ) : (
          <div>
            <div style={{
              background: '#0d0d1a', borderRadius: 8, padding: 12,
              marginBottom: 12, fontFamily: 'monospace', fontSize: 13,
              color: 'var(--accent)', wordBreak: 'break-all'
            }}>
              {window.location.origin + '/invite/' + linkCode}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} style={{
                flex: 1, background: copied ? 'var(--success)' : 'var(--accent)',
                color: '#fff', border: 'none', borderRadius: 8, padding: '10px',
                fontSize: 14, fontWeight: 500, cursor: 'pointer'
              }}>
                {copied ? '✓ Copied!' : '📋 Copy Link'}
              </button>
              <button onClick={handleGenerate} style={{
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 8, padding: '10px',
                fontSize: 14, cursor: 'pointer'
              }}>
                {'🔄'} Regenerate
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              {'🔐'} Invite links are end-to-end encrypted
            </div>
          </div>
        )}

        <button onClick={onClose} style={{
          marginTop: 16, background: 'none', border: 'none',
          color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
          width: '100%', textAlign: 'center'
        }}>
          Close
        </button>
      </div>
    </div>
  )
}
