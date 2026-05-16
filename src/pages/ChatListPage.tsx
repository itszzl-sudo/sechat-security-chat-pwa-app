import { useState } from 'react'
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
  const [searchResults, setSearchResults] = useState<RegisteredUser[]>([])

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
        <img src="/sechat.png" alt="SeChat" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <span style={{ fontSize: 20, fontWeight: 700 }}>SeChat</span>
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
