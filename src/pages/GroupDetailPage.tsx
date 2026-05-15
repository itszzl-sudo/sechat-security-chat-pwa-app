import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore, SPONSOR_ROLE_DISPLAY, type SponsorRole } from '../store/useStore'
import RoleBadge from '../components/RoleBadge'
import InviteLinkModal from '../components/InviteLinkModal'

const ROLES: SponsorRole[] = ['general_sponsor', 'senior_sponsor', 'core_sponsor', 'sole_exclusive_sponsor', 'reserve_fund_sponsor']

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const groups = useStore(s => s.groups)
  const setUserSponsorRole = useStore(s => s.setUserSponsorRole)
  const currentUser = useStore(s => s.currentUser)
  const [showInvite, setShowInvite] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)

  const group = groups.find(g => g.id === id)
  if (!group) {
    return (
      <div className="page">
        <header className="header">
          <button className="back-btn" onClick={() => navigate('/chats')}>{'←'}</button>
          <span className="header-title">Group not found</span>
        </header>
        <div className="empty-state">
          <div className="empty-state-icon">{'🔍'}</div>
          <div className="empty-state-text">This group doesn't exist.</div>
        </div>
      </div>
    )
  }

  const isAdmin = currentUser && group.members.find(m => m.userId === currentUser.id)?.isAdmin

  return (
    <div className="page">
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/chats')}>{'←'}</button>
        <span className="header-title">Group Info</span>
      </header>

      <div className="settings-page" style={{ overflowY: 'auto', flex: 1 }}>
        {/* Group Header */}
        <div className="settings-section" style={{ textAlign: 'center' }}>
          <div className="chat-avatar" style={{ width: 64, height: 64, fontSize: 28, margin: '0 auto 12px' }}>
            {group.name.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{group.name}</h2>
          {group.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{group.description}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
            <span className="badge encrypted">{'🔐'} E2EE</span>
            <span className="badge verified">{'✓'} Verified</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.members.length} members</span>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-section">
          <div className="settings-section-title">Actions</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowInvite(true)} style={{
              flex: 1, padding: '10px', borderRadius: 8,
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>{'🔗'} Invite</button>
            <button onClick={() => navigate('/chat/' + group.id)} style={{
              flex: 1, padding: '10px', borderRadius: 8,
              background: 'var(--success)', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>{'💬'} Chat</button>
          </div>
        </div>

        {/* Members with Roles */}
        <div className="settings-section">
          <div className="settings-section-title">{'👥'} Members & Roles</div>
          {group.members.map(member => (
            <div key={member.userId} className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="chat-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>{member.displayName}</span>
                    <RoleBadge role={member.sponsorRole} size="small" />
                    {member.isAdmin && <span className="badge verified" style={{ fontSize: 9 }}>Admin</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {'@' + member.username}
                  </div>
                </div>
              </div>

              {/* Role editor (admin only) */}
              {isAdmin && editingRole === member.userId && (
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {ROLES.map(role => (
                    <button key={role} onClick={() => {
                      setUserSponsorRole(member.userId, role)
                      setEditingRole(null)
                    }} style={{
                      padding: '4px 8px', borderRadius: 4, border: 'none',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      background: SPONSOR_ROLE_DISPLAY[role].color + '33',
                      color: SPONSOR_ROLE_DISPLAY[role].color
                    }}>
                      {SPONSOR_ROLE_DISPLAY[role].badge}
                    </button>
                  ))}
                  <button onClick={() => setEditingRole(null)} style={{
                    padding: '4px 8px', borderRadius: 4, border: 'none',
                    fontSize: 10, cursor: 'pointer', background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)'
                  }}>Cancel</button>
                </div>
              )}

              {isAdmin && editingRole !== member.userId && (
                <button onClick={() => setEditingRole(member.userId)} style={{
                  marginTop: 4, padding: '2px 8px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'none',
                  color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}>{'🏅'} Set Role</button>
              )}
            </div>
          ))}
        </div>

        {/* Security Info */}
        <div className="settings-section">
          <div className="settings-section-title">{'🔒'} Security</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>{'•'} End-to-end encrypted group chats</div>
            <div>{'•'} Sponsor roles managed by group admins</div>
            <div>{'•'} Invite links expire on demand</div>
            <div>{'•'} Anti-screenshot protection active</div>
            <div>{'•'} WebGPU anti-recording shield</div>
          </div>
        </div>
      </div>

      {showInvite && (
        <InviteLinkModal
          groupId={group.id}
          groupName={group.name}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  )
}
