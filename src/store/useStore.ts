import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MediaAttachment {
  id: string
  type: 'image' | 'video' | 'file'
  fileName: string
  fileSize: number
  mimeType: string
  dataUrl: string
  thumbnailUrl?: string
  duration?: number
  width?: number
  height?: number
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  content: string
  contentType: 'text' | 'image' | 'system'
  timestamp: number
  encrypted: boolean
  selfDestruct?: number
  readAt?: number
  editedAt?: number
  attachments?: MediaAttachment[]
}

export interface Chat {
  id: string
  name: string
  avatar: string
  lastMessage?: string
  lastMessageTime?: number
  unread: number
  isSelfDestruct?: boolean
  isVerified?: boolean
  isPinned?: boolean
  isMuted?: boolean
  encryptionKey?: string
}

export interface User {
  id: string
  username: string
  displayName: string
  avatar: string
  publicKey: string
  isOnline: boolean
  lastSeen?: number
}

export interface CallState {
  active: boolean
  withUserId?: string
  withUserName?: string
  direction?: 'incoming' | 'outgoing'
  status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
  duration: number
  isMuted: boolean
  isSpeakerOn: boolean
}

const initialCallState: CallState = {
  active: false,
  status: 'idle',
  duration: 0,
  isMuted: false,
  isSpeakerOn: false,
}

interface AppState {
  isAuthenticated: boolean
  currentUser: User | null
  chats: Chat[]
  messages: Record<string, Message[]>
  contacts: User[]
  securityLevel: 'standard' | 'high' | 'maximum'
  screenshotProtection: boolean
  webgpuProtection: boolean
  selfDestructTimer: number
  biometricEnabled: boolean
  loginAttempts: number
  isLocked: boolean
  callState: CallState
  setAuthenticated: (val: boolean) => void
  setCurrentUser: (user: User | null) => void
  addChat: (chat: Chat) => void
  addMessage: (chatId: string, message: Message) => void
  markRead: (chatId: string) => void
  setSecurityLevel: (level: 'standard' | 'high' | 'maximum') => void
  setScreenshotProtection: (val: boolean) => void
  setWebgpuProtection: (val: boolean) => void
  setSelfDestructTimer: (val: number) => void
  setBiometricEnabled: (val: boolean) => void
  incrementLoginAttempts: () => void
  resetLoginAttempts: () => void
  setLocked: (val: boolean) => void
  registerUser: (username: string, displayName: string) => void
  generateKeys: () => string
  setCallState: (state: Partial<CallState>) => void
  startCall: (userId: string, userName: string) => void
  endCall: () => void
  toggleMute: () => void
  toggleSpeaker: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      chats: [],
      messages: {},
      contacts: [],
      securityLevel: 'high',
      screenshotProtection: true,
      webgpuProtection: true,
      selfDestructTimer: 30,
      biometricEnabled: false,
      loginAttempts: 0,
      isLocked: false,
      callState: { ...initialCallState },

      setAuthenticated: (val) => set({ isAuthenticated: val }),
      setCurrentUser: (user) => set({ currentUser: user }),

      addChat: (chat) => set((s) => ({
        chats: s.chats.some(c => c.id === chat.id) ? s.chats : [chat, ...s.chats]
      })),

      addMessage: (chatId, message) => set((s) => ({
        messages: {
          ...s.messages,
          [chatId]: [...(s.messages[chatId] || []), message]
        },
        chats: s.chats.map(c =>
          c.id === chatId
            ? {
                ...c,
                lastMessage: message.content.substring(0, 50) + (message.attachments && message.attachments.length > 0 ? ' [Attachment]' : ''),
                lastMessageTime: message.timestamp,
                unread: c.unread + 1
              }
            : c
        )
      })),

      markRead: (chatId) => set((s) => ({
        chats: s.chats.map(c => c.id === chatId ? { ...c, unread: 0 } : c)
      })),

      setSecurityLevel: (level) => set({ securityLevel: level }),
      setScreenshotProtection: (val) => set({ screenshotProtection: val }),
      setWebgpuProtection: (val) => set({ webgpuProtection: val }),
      setSelfDestructTimer: (val) => set({ selfDestructTimer: val }),
      setBiometricEnabled: (val) => set({ biometricEnabled: val }),
      incrementLoginAttempts: () => set((s) => ({ loginAttempts: s.loginAttempts + 1 })),
      resetLoginAttempts: () => set({ loginAttempts: 0 }),
      setLocked: (val) => set({ isLocked: val }),

      registerUser: (username, displayName) => {
        const id = 'user_' + Math.random().toString(36).substr(2, 9)
        const key = get().generateKeys()
        set({
          currentUser: {
            id, username, displayName, avatar: '', publicKey: key,
            isOnline: true, lastSeen: Date.now()
          },
          isAuthenticated: true
        })
      },

      generateKeys: () => {
        return 'pk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0')).join('')
      },

      setCallState: (state) => set((s) => ({
        callState: { ...s.callState, ...state }
      })),

      startCall: (userId, userName) => set((s) => ({
        callState: {
          ...initialCallState,
          active: true,
          withUserId: userId,
          withUserName: userName,
          direction: 'outgoing',
          status: 'calling'
        }
      })),

      endCall: () => set((s) => ({
        callState: {
          ...s.callState,
          status: 'ended',
          active: false
        }
      })),

      toggleMute: () => set((s) => ({
        callState: { ...s.callState, isMuted: !s.callState.isMuted }
      })),

      toggleSpeaker: () => set((s) => ({
        callState: { ...s.callState, isSpeakerOn: !s.callState.isSpeakerOn }
      }))
    }),
    {
      name: 'privchat-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        chats: state.chats,
        messages: state.messages,
        contacts: state.contacts,
        securityLevel: state.securityLevel,
        selfDestructTimer: state.selfDestructTimer,
        biometricEnabled: state.biometricEnabled,
        callState: state.callState,
      })
    }
  )
)
