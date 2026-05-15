import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '..', 'src');

function write(path, content) {
  const fullPath = resolve(srcDir, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  console.log('Written:', fullPath.replace(srcDir, 'src'));
}

// ─────────────────────────────────────────────────────────────────────────────
// File 1: src/components/FriendRequestModal.tsx
// ─────────────────────────────────────────────────────────────────────────────

write('components/FriendRequestModal.tsx', `import { useStore, type FriendRequest } from '../store/useStore'

interface Props {
  onClose: () => void
}

export default function FriendRequestModal({ onClose }: Props) {
  const friendRequests = useStore(s => s.friendRequests)
  const approveFriendRequest = useStore(s => s.approveFriendRequest)
  const rejectFriendRequest = useStore(s => s.rejectFriendRequest)
  const registeredUsers = useStore(s => s.registeredUsers)
  const currentUser = useStore(s => s.currentUser)

  const pendingRequests = friendRequests.filter(
    r => r.status === 'pending' && r.toUserId === currentUser?.id
  )

  const getDisplayName = (userId: string): string => {
    const user = registeredUsers.find(u => u.id === userId)
    return user?.displayName || 'Unknown'
  }

  const getUsername = (userId: string): string => {
    const user = registeredUsers.find(u => u.id === userId)
    return user?.username || 'unknown'
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 10000
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', borderRadius: 16, padding: 24,
        maxWidth: 400, width: '90%', maxHeight: '80vh', overflow: 'auto',
        border: '1px solid var(--border)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', color: '#e8e8e8' }}>{'💌'} Friend Requests</h3>

        {pendingRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 14 }}>
            No pending friend requests.
          </div>
        ) : (
          pendingRequests.map(req => (
            <div key={req.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: '1px solid var(--border)'
            }}>
              <div className="chat-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                {req.fromDisplayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{req.fromDisplayName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{req.fromUsername}</div>
                {req.credential && (
                  <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 2 }}>
                    {'🔑'} Requires credential: {req.credential}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => approveFriendRequest(req.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: 'var(--success)', color: '#fff',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>{'✓'} Accept</button>
                <button onClick={() => rejectFriendRequest(req.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: 'var(--danger)', color: '#fff',
                    fontSize: 12, cursor: 'pointer'
                  }}>{'✕'} Decline</button>
              </div>
            </div>
          ))
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
`);

// ─────────────────────────────────────────────────────────────────────────────
// File 2: src/components/MergeAccounts.tsx
// ─────────────────────────────────────────────────────────────────────────────

write('components/MergeAccounts.tsx', `import { useState } from 'react'
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
`);

// ─────────────────────────────────────────────────────────────────────────────
// File 3: src/pages/ChatListPage.tsx
// ─────────────────────────────────────────────────────────────────────────────

write('pages/ChatListPage.tsx', `import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import RoleBadge from '../components/RoleBadge'
import FriendRequestModal from '../components/FriendRequestModal'
import MergeAccounts from '../components/MergeAccounts'
import type { SponsorRole, RegisteredUser } from '../store/useStore'

const CONTACTS = [
  { id: 'alice', name: 'Alice Johnson', avatar: 'A', isOnline: true, role: 'core_sponsor' as SponsorRole },
  { id: 'bob', name: 'Bob Smith', avatar: 'B', isOnline: false, role: 'senior_sponsor' as SponsorRole },
  { id: 'carol', name: 'Carol Davis', avatar: 'C', isOnline: true, role: 'general_sponsor' as SponsorRole },
  { id: 'dave', name: 'Dave Wilson', avatar: 'D', isOnline: true, role: 'sole_exclusive_sponsor' as SponsorRole },
  { id: 'eve', name: 'Eve Martin', avatar: 'E', isOnline: false, role: 'reserve_fund_sponsor' as SponsorRole },
]

export default function ChatListPage() {
  const navigate = useNavigate()
  const chats = useStore(s => s.chats)
  const addChat = useStore(s => s.addChat)
  const currentUser = useStore(s => s.currentUser)
  const groups = useStore(s => s.groups)
  const createGroup = useStore(s => s.createGroup)
  const generateInviteLink = useStore(s => s.generateInviteLink)
  const joinGroupByInvite = useStore(s => s.joinGroupByInvite)
  const friendRequests = useStore(s => s.friendRequests)
  const searchUsers = useStore(s => s.searchUsers)
  const sendFriendRequest = useStore(s => s.sendFriendRequest)

  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [showFriendRequests, setShowFriendRequests] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

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

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return
    const groupId = createGroup(newGroupName.trim(), newGroupDesc.trim())
    setShowCreateGroup(false)
    setNewGroupName('')
    setNewGroupDesc('')
    navigate('/group/' + groupId)
  }

  const handleInviteJoin = () => {
    const code = prompt('Enter invite code:')
    if (code) {
      const groupId = joinGroupByInvite(code.trim())
      if (groupId) {
        navigate('/group/' + groupId)
      } else {
        alert('Invalid or expired invite code.')
      }
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim().length >= 2) {
      const results = searchUsers(query.trim())
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }

  const handleSendRequest = (username: string) => {
    const success = sendFriendRequest(username)
    if (success) {
      alert('Friend request sent!')
    } else {
      alert('Failed to send request.')
    }
  }

  const pendingCount = friendRequests.filter(
    r => r.status === 'pending' && r.toUserId === currentUser?.id
  ).length

  return (
    <div className="page">
      <header className="header">
        <img src="/sechat.png" alt="PrivChat" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <span style={{ fontSize: 20, fontWeight: 700 }}>PrivChat</span>
        <div style={{ flex: 1 }} />
        <button
          className="header-action"
          onClick={() => setShowFriendRequests(true)}
          title="Friend Requests"
          style={{ position: 'relative' }}
        >
          {'💌'}
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--danger)', color: '#fff',
              borderRadius: '50%', width: 18, height: 18,
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1
            }}>{pendingCount}</span>
          )}
        </button>
        <button className="header-action" onClick={() => navigate('/settings')} title="Settings">{'⚙️'}</button>
      </header>

      <div style={{
        padding: '8px 16px', background: 'rgba(0, 184, 148, 0.08)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: 'var(--success)'
      }}>
        <span>{'🛡️'}</span>
        <span>All messages end-to-end encrypted • No screenshots</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          {currentUser?.username || 'Offline'}
        </span>
      </div>

      {/* Friend Search Bar */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search users by username..."
            value={searchQuery}
            onChange={e => {
              handleSearch(e.target.value)
              setShowUserSearch(true)
            }}
            onFocus={() => { if (searchResults.length > 0) setShowUserSearch(true) }}
            onBlur={() => setTimeout(() => setShowUserSearch(false), 200)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box'
            }}
          />
          {/* Search results dropdown */}
          {showUserSearch && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#1a1a2e', border: '1px solid var(--border)',
              borderRadius: 8, marginTop: 4, zIndex: 1000,
              maxHeight: 240, overflow: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              {searchResults.map(user => (
                <div key={user.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s'
                }}
                  onMouseDown={() => {
                    handleSendRequest(user.username)
                    setShowUserSearch(false)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,156,219,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div className="chat-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{user.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{user.username}</div>
                  </div>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => handleSendRequest(user.username)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none',
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                  >{'➕'} Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Groups Section */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span>Groups</span>
        <button
          onClick={() => setShowCreateGroup(!showCreateGroup)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--accent)', padding: 0, lineHeight: 1
          }}
          title="Create Group"
        >{'➕'}</button>
      </div>

      {showCreateGroup && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 8
        }}>
          <input
            type="text"
            placeholder="Group name"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newGroupDesc}
            onChange={e => setNewGroupDesc(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreateGroup}
              style={{
                flex: 1, padding: '8px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 600,
                fontSize: 13, cursor: 'pointer'
              }}
            >Create</button>
            <button
              onClick={() => {
                setShowCreateGroup(false)
                setNewGroupName('')
                setNewGroupDesc('')
              }}
              style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'none', color: 'var(--text-secondary)',
                fontSize: 13, cursor: 'pointer'
              }}
            >Cancel</button>
          </div>
        </div>
      )}

      <div className="chat-list">
        {groups.length === 0 && (
          <div style={{
            padding: '16px', textAlign: 'center',
            fontSize: 13, color: 'var(--text-muted)'
          }}>
            No groups yet. Create one using the {'➕'} button above.
          </div>
        )}
        {groups.map(group => (
          <div
            key={group.id}
            className="chat-item"
            onClick={() => navigate('/group/' + group.id)}
          >
            <div className="chat-avatar" style={{ position: 'relative' }}>
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div className="chat-info">
              <div className="chat-name">
                {group.name}
                <span className="badge encrypted" style={{ fontSize: 10 }}>{'🔐'} E2EE</span>
              </div>
              <div className="chat-last-message">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                {group.description ? ' • ' + group.description.substring(0, 30) + (group.description.length > 30 ? '...' : '') : ''}
              </div>
            </div>
            <div className="chat-meta">
              <span className="badge verified" style={{ fontSize: 10 }}>{group.members.length}</span>
            </div>
          </div>
        ))}

        <div
          onClick={handleInviteJoin}
          style={{
            padding: '12px 16px', cursor: 'pointer',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'var(--accent)', fontWeight: 500
          }}
        >
          <span>{'🔗'}</span>
          <span>Join with Invite</span>
        </div>
      </div>

      {/* Contacts Section */}
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
                {' '}
                <RoleBadge role={contact.role} size="small" />
                <span className="badge verified" style={{ fontSize: 10 }}>{'✓'} Verified</span>
              </div>
              <div className="chat-last-message">
                {contact.isOnline ? '🟢 Online' : '⚫ Offline'} • End-to-end encrypted
              </div>
            </div>
            <div className="chat-meta">
              <span className="badge encrypted" style={{ fontSize: 10 }}>{'🔐'} E2EE</span>
            </div>
          </div>
        ))}
      </div>

      {/* Merge Accounts Section */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 13
      }}>
        <button
          onClick={() => setShowMerge(true)}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: 'rgba(45, 156, 219, 0.08)', color: 'var(--accent)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
        >
          {'🔄'} Merge Accounts
        </button>
      </div>

      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'center', gap: 16,
        fontSize: 11, color: 'var(--text-muted)'
      }}>
        <span>{'🔒'} Anti-screenshot</span>
        <span>{'⚡'} WebGPU Shield</span>
        <span>{'📱'} PWA Ready</span>
        <span>{'🔐'} E2E Encrypted</span>
      </div>

      {/* Modals */}
      {showFriendRequests && <FriendRequestModal onClose={() => setShowFriendRequests(false)} />}
      {showMerge && <MergeAccounts onClose={() => setShowMerge(false)} />}
    </div>
  )
}
`);

// ─────────────────────────────────────────────────────────────────────────────
// File 4: src/pages/SettingsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────

write('pages/SettingsPage.tsx', `import { useState } from 'react'
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
    a.download = 'privchat-keys.json'
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
        <button className="back-btn" onClick={() => navigate('/chats')}>{'\\u2190'}</button>
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
                {'\\uD83D\\uDCF1'} {currentUser?.id || 'N/A'}
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
              <div className="settings-item-icon">{'\\uD83D\\uDCF8'}</div>
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
              <div className="settings-item-icon">{'\\u26A1'}</div>
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
              <div className="settings-item-icon">{'\\u23F1\\uFE0F'}</div>
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
              <div className="settings-item-icon">{'\\uD83D\\uDD11'}</div>
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
              <div className="settings-item-icon">{'\\uD83D\\uDCAC'}</div>
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
            <span className="badge encrypted">{'\\uD83D\\uDD10'} Signal Protocol</span>
            <span className="badge verified">{'\\u2713'} Verified</span>
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
            {'\\uD83D\\uDD11'} Export Keys
          </button>
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleClearMessages}>
            {'\\uD83D\\uDDD1\\uFE0F'} Clear Messages
          </button>
          <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleLogout}>
            {'\\uD83D\\uDEAA'} Sign Out
          </button>
          <button className="btn-danger" style={{ width: '100%' }} onClick={handleDeleteAccount}>
            {'\\u26A0\\uFE0F'} Delete Account
          </button>
        </div>

        {/* About Section */}
        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>{'\\uD83D\\uDCF1'} PrivChat v1.0.0</div>
            <div>{'\\uD83D\\uDD10'} Signal Protocol E2EE</div>
            <div>{'\\uD83D\\uDCF8'} Anti-screenshot protection</div>
            <div>{'\\u26A1'} WebGPU hardware security</div>
            <div>{'\\uD83C\\uDF10'} PWA enabled</div>
            <div>{'\\uD83D\\uDD12'} Zero-knowledge architecture</div>
            <div>{'\\uD83D\\uDEE1\\uFE0F'} Built with React + TypeScript</div>
          </div>
        </div>
      </div>

      {/* Merge Modal */}
      {showMerge && <MergeAccounts onClose={() => setShowMerge(false)} />}
    </div>
  )
}
`);

console.log('\\nAll 4 files written successfully!');
