import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MediaAttachment {
  id: string;
  type: "image" | "video" | "file";
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  contentType: "text" | "image" | "system";
  timestamp: number;
  encrypted: boolean;
  selfDestruct?: number;
  readAt?: number;
  editedAt?: number;
  attachments?: MediaAttachment[];
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unread: number;
  isSelfDestruct?: boolean;
  isVerified?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  encryptionKey?: string;
}

export type SponsorRole =
  | "general_sponsor"
  | "senior_sponsor"
  | "core_sponsor"
  | "sole_exclusive_sponsor"
  | "reserve_fund_sponsor"
  | "none";

export const SPONSOR_ROLE_DISPLAY: Record<
  SponsorRole,
  { label: string; badge: string; color: string; level: number }
> = {
  general_sponsor: {
    label: "General Sponsor",
    badge: "GS",
    color: "#95a5a6",
    level: 1,
  },
  senior_sponsor: {
    label: "Senior Sponsor",
    badge: "SS",
    color: "#f1c40f",
    level: 2,
  },
  core_sponsor: {
    label: "Core Sponsor",
    badge: "CS",
    color: "#e67e22",
    level: 3,
  },
  sole_exclusive_sponsor: {
    label: "Sole Exclusive Sponsor",
    badge: "SES",
    color: "#9b59b6",
    level: 4,
  },
  reserve_fund_sponsor: {
    label: "Reserve Fund Sponsor",
    badge: "RFS",
    color: "#e74c3c",
    level: 5,
  },
  none: { label: "", badge: "", color: "", level: 0 },
};

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen?: number;
  sponsorRole: SponsorRole;
}

export interface InviteLink {
  id: string;
  groupId: string;
  code: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  maxUses?: number;
  useCount: number;
  isRevoked: boolean;
}

export interface GroupMember {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  sponsorRole: SponsorRole;
  joinedAt: number;
  isAdmin: boolean;
}

export interface Group extends Chat {
  description: string;
  createdBy: string;
  createdAt: number;
  members: GroupMember[];
  inviteLinks: InviteLink[];
}

export interface CallState {
  active: boolean;
  withUserId?: string;
  withUserName?: string;
  direction?: "incoming" | "outgoing";
  status: "idle" | "calling" | "ringing" | "connected" | "ended";
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
}

const initialCallState: CallState = {
  active: false,
  status: "idle",
  duration: 0,
  isMuted: false,
  isSpeakerOn: false,
};

interface AppState {
  isAuthenticated: boolean;
  currentUser: User | null;
  chats: Chat[];
  messages: Record<string, Message[]>;
  contacts: User[];
  securityLevel: "standard" | "high" | "maximum";
  screenshotProtection: boolean;
  webgpuProtection: boolean;
  selfDestructTimer: number;
  biometricEnabled: boolean;
  loginAttempts: number;
  isLocked: boolean;
  callState: CallState;
  groups: Group[];
  setAuthenticated: (val: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  addChat: (chat: Chat) => void;
  addMessage: (chatId: string, message: Message) => void;
  markRead: (chatId: string) => void;
  setSecurityLevel: (level: "standard" | "high" | "maximum") => void;
  setScreenshotProtection: (val: boolean) => void;
  setWebgpuProtection: (val: boolean) => void;
  setSelfDestructTimer: (val: number) => void;
  setBiometricEnabled: (val: boolean) => void;
  incrementLoginAttempts: () => void;
  resetLoginAttempts: () => void;
  setLocked: (val: boolean) => void;
  registerUser: (username: string, displayName: string) => void;
  generateKeys: () => string;
  setCallState: (state: Partial<CallState>) => void;
  startCall: (userId: string, userName: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  createGroup: (name: string, description: string) => string;
  joinGroup: (
    groupId: string,
    userId: string,
    username: string,
    displayName: string,
  ) => void;
  generateInviteLink: (groupId: string) => string;
  joinGroupByInvite: (code: string) => string | null;
  setUserSponsorRole: (userId: string, role: SponsorRole) => void;
  getGroupMembers: (groupId: string) => GroupMember[];
  addGroupMessage: (groupId: string, message: Message) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      chats: [],
      messages: {},
      contacts: [],
      securityLevel: "high",
      screenshotProtection: true,
      webgpuProtection: true,
      selfDestructTimer: 30,
      biometricEnabled: false,
      loginAttempts: 0,
      isLocked: false,
      callState: { ...initialCallState },
      groups: [],

      setAuthenticated: (val) => set({ isAuthenticated: val }),
      setCurrentUser: (user) => set({ currentUser: user }),

      addChat: (chat) =>
        set((s) => ({
          chats: s.chats.some((c) => c.id === chat.id)
            ? s.chats
            : [chat, ...s.chats],
        })),

      addMessage: (chatId, message) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [chatId]: [...(s.messages[chatId] || []), message],
          },
          chats: s.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  lastMessage:
                    message.content.substring(0, 50) +
                    (message.attachments && message.attachments.length > 0
                      ? " [Attachment]"
                      : ""),
                  lastMessageTime: message.timestamp,
                  unread: c.unread + 1,
                }
              : c,
          ),
        })),

      markRead: (chatId) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, unread: 0 } : c,
          ),
        })),

      setSecurityLevel: (level) => set({ securityLevel: level }),
      setScreenshotProtection: (val) => set({ screenshotProtection: val }),
      setWebgpuProtection: (val) => set({ webgpuProtection: val }),
      setSelfDestructTimer: (val) => set({ selfDestructTimer: val }),
      setBiometricEnabled: (val) => set({ biometricEnabled: val }),
      incrementLoginAttempts: () =>
        set((s) => ({ loginAttempts: s.loginAttempts + 1 })),
      resetLoginAttempts: () => set({ loginAttempts: 0 }),
      setLocked: (val) => set({ isLocked: val }),

      registerUser: (username, displayName) => {
        const id = "user_" + Math.random().toString(36).substr(2, 9);
        const key = get().generateKeys();
        const sponsorRoles: SponsorRole[] = [
          "general_sponsor",
          "senior_sponsor",
          "core_sponsor",
          "sole_exclusive_sponsor",
          "reserve_fund_sponsor",
        ];
        const randomRole =
          sponsorRoles[Math.floor(Math.random() * sponsorRoles.length)];
        set({
          currentUser: {
            id,
            username,
            displayName,
            avatar: "",
            publicKey: key,
            isOnline: true,
            lastSeen: Date.now(),
            sponsorRole: "none" as SponsorRole,
          },
          isAuthenticated: true,
        });
        setTimeout(() => {
          get().setUserSponsorRole(id, randomRole);
        }, 500);
      },

      generateKeys: () => {
        return (
          "pk_" +
          Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        );
      },

      setCallState: (state) =>
        set((s) => ({
          callState: { ...s.callState, ...state },
        })),

      startCall: (userId, userName) =>
        set((s) => ({
          callState: {
            ...initialCallState,
            active: true,
            withUserId: userId,
            withUserName: userName,
            direction: "outgoing",
            status: "calling",
          },
        })),

      endCall: () =>
        set((s) => ({
          callState: {
            ...s.callState,
            status: "ended",
            active: false,
          },
        })),

      toggleMute: () =>
        set((s) => ({
          callState: { ...s.callState, isMuted: !s.callState.isMuted },
        })),

      toggleSpeaker: () =>
        set((s) => ({
          callState: { ...s.callState, isSpeakerOn: !s.callState.isSpeakerOn },
        })),

      createGroup: (name, description) => {
        const state = get();
        const user = state.currentUser;
        if (!user) return "";
        const id = "group_" + Math.random().toString(36).substr(2, 9);
        const newGroup: Group = {
          id,
          name,
          avatar: "",
          description,
          createdBy: user.id,
          createdAt: Date.now(),
          members: [
            {
              userId: user.id,
              username: user.username,
              displayName: user.displayName,
              avatar: user.avatar,
              sponsorRole: user.sponsorRole,
              joinedAt: Date.now(),
              isAdmin: true,
            },
          ],
          inviteLinks: [],
          lastMessage: undefined,
          lastMessageTime: undefined,
          unread: 0,
          isVerified: false,
        };
        set((s) => ({ groups: [...s.groups, newGroup] }));
        return id;
      },

      joinGroup: (groupId, userId, username, displayName) => {
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== groupId) return g;
            if (g.members.some((m) => m.userId === userId)) return g;
            const user = s.currentUser;
            return {
              ...g,
              members: [
                ...g.members,
                {
                  userId,
                  username,
                  displayName,
                  avatar: user?.avatar || "",
                  sponsorRole: (user?.sponsorRole || "none") as SponsorRole,
                  joinedAt: Date.now(),
                  isAdmin: false,
                },
              ],
            };
          }),
        }));
      },

      generateInviteLink: (groupId) => {
        const code =
          "privchat-invite-" +
          Math.random().toString(36).substr(2, 6).toUpperCase();
        const state = get();
        const user = state.currentUser;
        const link: InviteLink = {
          id: "invite_" + Math.random().toString(36).substr(2, 9),
          groupId,
          code,
          createdBy: user?.id || "",
          createdAt: Date.now(),
          useCount: 0,
          isRevoked: false,
        };
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, inviteLinks: [...g.inviteLinks, link] }
              : g,
          ),
        }));
        return code;
      },

      joinGroupByInvite: (code) => {
        const state = get();
        const group = state.groups.find((g) =>
          g.inviteLinks.some((l) => l.code === code && !l.isRevoked),
        );
        if (!group || !state.currentUser) return null;
        const user = state.currentUser;
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== group.id) return g;
            if (g.members.some((m) => m.userId === user.id)) return g;
            return {
              ...g,
              members: [
                ...g.members,
                {
                  userId: user.id,
                  username: user.username,
                  displayName: user.displayName,
                  avatar: user.avatar,
                  sponsorRole: user.sponsorRole,
                  joinedAt: Date.now(),
                  isAdmin: false,
                },
              ],
              inviteLinks: g.inviteLinks.map((l) =>
                l.code === code ? { ...l, useCount: l.useCount + 1 } : l,
              ),
            };
          }),
        }));
        return group.id;
      },

      setUserSponsorRole: (userId, role) =>
        set((s) => ({
          currentUser:
            s.currentUser?.id === userId
              ? { ...s.currentUser, sponsorRole: role }
              : s.currentUser,
          contacts: s.contacts.map((c) =>
            c.id === userId ? { ...c, sponsorRole: role } : c,
          ),
          groups: s.groups.map((g) => ({
            ...g,
            members: g.members.map((m) =>
              m.userId === userId ? { ...m, sponsorRole: role } : m,
            ),
          })),
        })),

      getGroupMembers: (groupId) => {
        const group = get().groups.find((g) => g.id === groupId);
        return group?.members || [];
      },

      addGroupMessage: (groupId, message) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [groupId]: [...(s.messages[groupId] || []), message],
          },
          groups: s.groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  lastMessage:
                    message.content.substring(0, 50) +
                    (message.attachments && message.attachments.length > 0
                      ? " [Attachment]"
                      : ""),
                  lastMessageTime: message.timestamp,
                  unread: g.unread + 1,
                }
              : g,
          ),
        })),
    }),
    {
      name: "privchat-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        chats: state.chats,
        messages: state.messages,
        contacts: state.contacts,
        groups: state.groups,
        securityLevel: state.securityLevel,
        selfDestructTimer: state.selfDestructTimer,
        biometricEnabled: state.biometricEnabled,
        callState: state.callState,
      }),
    },
  ),
);
