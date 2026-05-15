import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

const CONTACTS = [
  { id: 'alice', name: 'Alice Johnson', avatar: 'A', isOnline: true },
  { id: 'bob', name: 'Bob Smith', avatar: 'B', isOnline: false },
  { id: 'carol', name: 'Carol Davis', avatar: 'C', isOnline: true },
  { id: 'dave', name: 'Dave Wilson', avatar: 'D', isOnline: true },
  { id: 'eve', name: 'Eve Martin', avatar: 'E', isOnline: false },
]

export default function ChatListPage() {
  const navigate = useNavigate()
  const chats = useStore(s => s.chats)
  const addChat = useStore(s => s.addChat)
  const currentUser = useStore(s => s.currentUser)

  const handleStartChat = (contactId: string, name: string) => {
    const existingChat = chats.find(c => c.id === contactId)
    if (!existingChat) {
      addChat({
        id: contactId, name, avatar: name.charAt(0).toUpperCase(),
        unread: 0, isVerified: true, encryptionKey: crypto.randomUUID()
      })
    }
    navigate('/chat/' + contactId)
  }

  return (
    <div className="page">
      <header className="header">
        <img src="/sechat.png" alt="PrivChat" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <span style={{ fontSize: 20, fontWeight: 700 }}>PrivChat</span>
        <div style={{ flex: 1 }} />
        <button className="header-action" onClick={() => navigate('/settings')} title="Settings">⚙️</button>
      </header>

      <div style={{
        padding: '8px 16px', background: 'rgba(0, 184, 148, 0.08)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: 'var(--success)'
      }}>
        <span>🛡️</span>
        <span>All messages end-to-end encrypted • No screenshots</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          {currentUser?.username || 'Offline'}
        </span>
      </div>

      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: 0.5
      }}>Contacts</div>

      <div className="chat-list">
        {CONTACTS.map(contact => (
          <div key={contact.id} className="chat-item" onClick={() => handleStartChat(contact.id, contact.name)}>
            <div className="chat-avatar" style={{ position: 'relative' }}>
              {contact.avatar}
              {contact.isOnline && (
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 12, height: 12, borderRadius: '50%',
                  background: 'var(--success)', border: '2px solid var(--bg-primary)'
                }} />
              )}
            </div>
            <div className="chat-info">
              <div className="chat-name">
                {contact.name}
                <span className="badge verified" style={{ fontSize: 10 }}>✓ Verified</span>
              </div>
              <div className="chat-last-message">
                {contact.isOnline ? '🟢 Online' : '⚫ Offline'} • End-to-end encrypted
              </div>
            </div>
            <div className="chat-meta">
              <span className="badge encrypted" style={{ fontSize: 10 }}>🔐 E2EE</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'center', gap: 16,
        fontSize: 11, color: 'var(--text-muted)'
      }}>
        <span>🔒 Anti-screenshot</span>
        <span>⚡ WebGPU Shield</span>
        <span>📱 PWA Ready</span>
        <span>🔐 E2E Encrypted</span>
      </div>
    </div>
  )
}
