// Bot → sechat API for sponsor management
// The bot calls this API to notify sechat of role changes

import { useStore, type SponsorRole } from '../store/useStore'

export interface SponsorUpdate {
  userId: string
  username: string
  displayName: string
  role: SponsorRole
  totalDonated?: number
}

export interface SponsorPublic {
  userId: string
  username: string
  displayName: string
  role: SponsorRole
  avatar: string
}

// Called by bot when a sponsor role changes
export function handleSponsorUpdate(update: SponsorUpdate): boolean {
  const state = useStore.getState()

  // Update the user's sponsor role in registeredUsers
  const users = state.registeredUsers.map(u =>
    u.id === update.userId
      ? { ...u, sponsorRole: update.role }
      : u
  )
  useStore.setState({ registeredUsers: users })

  // If this is the current user, update currentUser too
  if (state.currentUser?.id === update.userId) {
    useStore.setState({
      currentUser: { ...state.currentUser, sponsorRole: update.role }
    })
  }

  // Update contacts
  const contacts = state.contacts.map(c =>
    c.id === update.userId
      ? { ...c, sponsorRole: update.role }
      : c
  )
  useStore.setState({ contacts })

  // Update group members
  const groups = state.groups.map(g => ({
    ...g,
    members: g.members.map(m =>
      m.userId === update.userId
        ? { ...m, sponsorRole: update.role }
        : m
    )
  }))
  useStore.setState({ groups })

  console.log('[SponsorAPI] Role updated:', update.username, '->', update.role)
  return true
}

// Get active sponsors for flying effects
export function getActiveSponsors(): SponsorPublic[] {
  const state = useStore.getState()
  const allUsers = state.registeredUsers

  // Only return users with actual sponsor roles
  return allUsers
    .filter(u => u.sponsorRole !== 'none')
    .map(u => ({
      userId: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.sponsorRole,
      avatar: u.displayName.charAt(0).toUpperCase(),
    }))
}

// Check if a specific user has sponsor role
export function getUserSponsorRole(userId: string): SponsorRole {
  const state = useStore.getState()
  const user = state.registeredUsers.find(u => u.id === userId)
  return user?.sponsorRole || 'none'
}
