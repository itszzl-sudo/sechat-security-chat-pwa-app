import { useStore, type FriendRequest } from '../store/useStore'

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
