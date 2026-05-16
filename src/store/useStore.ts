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

// ─── NEW INTERFACES ────────────────────────────────────────────────────────────

export interface RegisteredUser {
  id: string;
  username: string;
  displayName: string;
  publicKey: string;
  sponsorRole: SponsorRole;
  createdAt: number;
  mergedInto?: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromDisplayName: string;
  toUserId: string;
  toUsername: string;
  status: "pending" | "approved" | "rejected";
  credential?: string;
  createdAt: number;
}

export interface AutoApproveSettings {
  enabled: boolean;
  requiredCredential: string;
}

export interface PendingRegistration {
  username: string;
  displayName: string;
  startedAt: number;
  expiresAt: number;
}

// ─── INITIAL VALUES ───────────────────────────────────────────────────────────

const initialCallState: CallState = {
  active: false,
  status: "idle",
  duration: 0,
  isMuted: false,
  isSpeakerOn: false,
};

const initialAutoApproveSettings: AutoApproveSettings = {
  enabled: false,
  requiredCredential: "",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Generate a random alphanumeric suffix of given length */
function randomSuffix(length: number = 5): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/** Generate a unique id */
function uid(prefix: string = "id"): string {
  return prefix + "_" + randomSuffix(9);
}

// ─── APP STATE ────────────────────────────────────────────────────────────────

interface AppState {
  // ── PERSISTED ──
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
  registeredUsers: RegisteredUser[];
  friendRequests: FriendRequest[];
  autoApproveSettings: AutoApproveSettings;

  // ── EPHEMERAL (not persisted) ──
  pendingRegistrations: PendingRegistration[];
  currentUsername: string;
  registrationStep: "generating" | "webauthn" | "totp" | "ready" | "locked";
  totpSecret: string;
  totpQRUrl: string;
  registrationTimer: number;
  isWebAuthnAvailable: boolean;
  authMethod: "webauthn" | "totp" | null;
  userSearchResults: RegisteredUser[];
  mergeCode: string;

  // ── SPONSOR EFFECTS ──
  sponsorEffectQueue: {
    userId: string;
    username: string;
    displayName: string;
    role: SponsorRole;
    avatar: string;
  }[];
  lastSponsorEffectTime: number;

  // ── EXISTING ACTIONS ──
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

  // ── NEW AUTH ACTIONS ──
  generateUsername: () => string;
  startRegistration: () => Promise<string>;
  attemptWebAuthnRegister: (
    username: string,
    displayName: string,
  ) => Promise<boolean>;
  attemptWebAuthnLogin: (username: string) => Promise<boolean>;
  setupTOTP: (username: string) => string;
  verifyTOTPAndRegister: (
    username: string,
    displayName: string,
    code: string,
  ) => boolean;
  completeRegistration: (username: string, displayName: string) => void;
  loginUser: (username: string) => Promise<boolean>;
  checkUsernameAvailable: (username: string) => boolean;
  releaseUsername: (username: string) => void;
  tickRegistrationTimer: () => void;
  cancelRegistration: () => void;

  // ── NEW FRIEND ACTIONS ──
  searchUsers: (query: string) => RegisteredUser[];
  sendFriendRequest: (toUsername: string, credential?: string) => boolean;
  approveFriendRequest: (requestId: string) => void;
  rejectFriendRequest: (requestId: string) => void;
  setAutoApprove: (enabled: boolean, credential: string) => void;
  getPendingFriendRequests: () => FriendRequest[];

  // ── NEW MERGE ACTIONS ──
  generateMergeCode: () => string;
  mergeAccounts: (mergeCode: string) => boolean;
  getAccountUsernames: () => string[];
  dissolveMerge: (targetUsername: string) => boolean;

  // ── NEW HELPERS ──
  getUserByUsername: (username: string) => RegisteredUser | undefined;
  isUsernameRegistered: (username: string) => boolean;
}

// ─── STORE ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── PERSISTED STATE ──
      isAuthenticated: false,
      currentUser: null,
      chats: [],
      messages: {},
      contacts: [],
      securityLevel: "high",
      screenshotProtection: false,
      webgpuProtection: false,
      selfDestructTimer: 30,
      biometricEnabled: false,
      loginAttempts: 0,
      isLocked: false,
      callState: { ...initialCallState },
      groups: [],
      registeredUsers: [],
      friendRequests: [],
      autoApproveSettings: { ...initialAutoApproveSettings },

      // ── EPHEMERAL STATE ──
      pendingRegistrations: [],
      currentUsername: "",
      registrationStep: "generating",
      totpSecret: "",
      totpQRUrl: "",
      registrationTimer: 0,
      isWebAuthnAvailable:
        typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
      authMethod: null,
      userSearchResults: [],
      mergeCode: "",

      // ── SPONSOR EFFECTS ──
      sponsorEffectQueue: [],
      lastSponsorEffectTime: 0,

      // ══════════════════════════════════════════════════════════════════
      // EXISTING ACTIONS
      // ══════════════════════════════════════════════════════════════════

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
          "sechat-invite-" +
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

      // ══════════════════════════════════════════════════════════════════
      // NEW AUTH ACTIONS
      // ══════════════════════════════════════════════════════════════════

      generateUsername: () => {
        const domain =
          typeof window !== "undefined"
            ? window.location.hostname
            : "localhost";
        const username = "sechat://" + domain + "/" + randomSuffix(8);
        return username;
      },

      startRegistration: async () => {
        const username = get().generateUsername();
        const now = Date.now();
        const pending: PendingRegistration = {
          username,
          displayName: "",
          startedAt: now,
          expiresAt: now + 5 * 60 * 1000, // 5 minutes
        };
        set({
          currentUsername: username,
          pendingRegistrations: [...get().pendingRegistrations, pending],
          registrationStep: "generating",
          registrationTimer: 300, // 5 minutes in seconds
        });
        return username;
      },

      attemptWebAuthnRegister: async (
        username: string,
        displayName: string,
      ) => {
        try {
          if (!window.PublicKeyCredential) return false;

          // Generate a random challenge
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);

          const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions =
            {
              challenge,
              rp: { name: "SeChat", id: window.location.hostname },
              user: {
                id: new TextEncoder().encode(username),
                name: username,
                displayName,
              },
              pubKeyCredParams: [
                { alg: -7, type: "public-key" },
                { alg: -257, type: "public-key" },
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
              },
              timeout: 60000,
            };

          const credential = (await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
          })) as PublicKeyCredential | null;

          if (!credential) return false;

          // Store the credential id (base64url encoded)
          const credentialId = arrayBufferToBase64Url(credential.rawId);
          localStorage.setItem(`webauthn_credential_${username}`, credentialId);

          return true;
        } catch {
          return false;
        }
      },

      attemptWebAuthnLogin: async (username: string) => {
        try {
          if (!window.PublicKeyCredential) return false;

          const storedCredentialId = localStorage.getItem(
            `webauthn_credential_${username}`,
          );
          if (!storedCredentialId) return false;

          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);

          const credentialIdBytes = base64UrlToArrayBuffer(storedCredentialId);

          const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions =
            {
              challenge,
              allowCredentials: [
                {
                  id: credentialIdBytes,
                  type: "public-key",
                },
              ],
              userVerification: "required",
              timeout: 60000,
            };

          const assertion = (await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
          })) as PublicKeyCredential | null;

          return assertion !== null;
        } catch {
          return false;
        }
      },

      setupTOTP: (username: string) => {
        // Generate a random TOTP secret
        const secretBytes = new Uint8Array(20);
        crypto.getRandomValues(secretBytes);
        const secret = arrayBufferToBase32(secretBytes);

        const issuer = "SeChat";
        const encodedUsername = encodeURIComponent(username);
        const encodedIssuer = encodeURIComponent(issuer);
        const qrUrl = `otpauth://totp/${encodedIssuer}:${encodedUsername}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

        set({
          totpSecret: secret,
          totpQRUrl: qrUrl,
          registrationStep: "totp",
          authMethod: "totp",
        });

        return secret;
      },

      verifyTOTPAndRegister: (
        username: string,
        displayName: string,
        code: string,
      ) => {
        // In a real app we'd verify the TOTP code against the secret.
        // For this implementation we accept any 6-digit code.
        if (!/^\d{6}$/.test(code)) return false;

        get().completeRegistration(username, displayName);
        return true;
      },

      completeRegistration: (username: string, displayName: string) => {
        const existing = get().registeredUsers;
        if (existing.some((u) => u.username === username)) return;

        const id = uid("user");
        const publicKey = get().generateKeys();

        const sponsorRoles: SponsorRole[] = [
          "general_sponsor",
          "senior_sponsor",
          "core_sponsor",
          "sole_exclusive_sponsor",
          "reserve_fund_sponsor",
        ];
        const randomRole =
          sponsorRoles[Math.floor(Math.random() * sponsorRoles.length)];

        const newUser: User = {
          id,
          username,
          displayName,
          avatar: "",
          publicKey,
          isOnline: true,
          lastSeen: Date.now(),
          sponsorRole: "none",
        };

        const registeredUser: RegisteredUser = {
          id,
          username,
          displayName,
          publicKey,
          sponsorRole: "none",
          createdAt: Date.now(),
        };

        set({
          currentUser: newUser,
          isAuthenticated: true,
          registeredUsers: [...existing, registeredUser],
          registrationStep: "ready",
          authMethod: null,
          totpSecret: "",
          totpQRUrl: "",
          currentUsername: "",
          registrationTimer: 0,
        });

        // Assign a random sponsor role after a short delay
        setTimeout(() => {
          get().setUserSponsorRole(id, randomRole);
        }, 500);
      },

      loginUser: async (username: string) => {
        const state = get();
        const registered = state.registeredUsers.find(
          (u) => u.username === username,
        );
        if (!registered) return false;

        // If merged, resolve to primary account
        let targetUsername = username;
        if (registered.mergedInto) {
          targetUsername = registered.mergedInto;
        }

        const targetUser = state.registeredUsers.find(
          (u) => u.username === targetUsername,
        );
        if (!targetUser) return false;

        // Try WebAuthn login if available
        const webAuthnSuccess = await get().attemptWebAuthnLogin(username);
        if (!webAuthnSuccess) return false;

        const userForStore: User = {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          avatar: "",
          publicKey: targetUser.publicKey,
          isOnline: true,
          lastSeen: Date.now(),
          sponsorRole: targetUser.sponsorRole,
        };

        set({
          currentUser: userForStore,
          isAuthenticated: true,
        });

        return true;
      },

      checkUsernameAvailable: (username: string) => {
        return !get().registeredUsers.some((u) => u.username === username);
      },

      releaseUsername: (username: string) => {
        set((s) => ({
          pendingRegistrations: s.pendingRegistrations.filter(
            (p) => p.username !== username,
          ),
        }));
      },

      tickRegistrationTimer: () => {
        set((s) => ({
          registrationTimer: Math.max(0, s.registrationTimer - 1),
        }));
      },

      cancelRegistration: () => {
        const state = get();
        if (state.currentUsername) {
          get().releaseUsername(state.currentUsername);
        }
        set({
          currentUsername: "",
          registrationStep: "generating",
          totpSecret: "",
          totpQRUrl: "",
          registrationTimer: 0,
          authMethod: null,
        });
      },

      // ══════════════════════════════════════════════════════════════════
      // NEW FRIEND ACTIONS
      // ══════════════════════════════════════════════════════════════════

      searchUsers: (query: string) => {
        if (!query.trim()) return [];
        const lower = query.toLowerCase();
        return get().registeredUsers.filter(
          (u) =>
            u.username.toLowerCase().includes(lower) ||
            u.displayName.toLowerCase().includes(lower),
        );
      },

      sendFriendRequest: (toUsername: string, credential?: string) => {
        const state = get();
        const fromUser = state.currentUser;
        if (!fromUser) return false;

        const toUser = state.registeredUsers.find(
          (u) => u.username === toUsername,
        );
        if (!toUser) return false;
        if (toUser.id === fromUser.id) return false;

        // Check existing requests
        const existing = state.friendRequests.find(
          (r) =>
            r.fromUserId === fromUser.id &&
            r.toUserId === toUser.id &&
            r.status === "pending",
        );
        if (existing) return false;

        // Auto-approve if the target has auto-approve enabled and credential matches
        if (
          state.autoApproveSettings.enabled &&
          credential === state.autoApproveSettings.requiredCredential
        ) {
          // Create approved request and setup chat
          const request: FriendRequest = {
            id: uid("fr"),
            fromUserId: fromUser.id,
            fromUsername: fromUser.username,
            fromDisplayName: fromUser.displayName,
            toUserId: toUser.id,
            toUsername: toUser.username,
            status: "approved",
            credential,
            createdAt: Date.now(),
          };

          const chatId = uid("chat");
          const chat: Chat = {
            id: chatId,
            name: toUser.displayName,
            avatar: "",
            lastMessage: undefined,
            lastMessageTime: undefined,
            unread: 0,
            isVerified: true,
          };

          const contactForCurrent: User = {
            id: toUser.id,
            username: toUser.username,
            displayName: toUser.displayName,
            avatar: "",
            publicKey: toUser.publicKey,
            isOnline: false,
            sponsorRole: toUser.sponsorRole,
          };

          set((s) => ({
            friendRequests: [...s.friendRequests, request],
            chats: s.chats.some((c) => c.id === chat.id)
              ? s.chats
              : [chat, ...s.chats],
            contacts: s.contacts.some((c) => c.id === contactForCurrent.id)
              ? s.contacts
              : [...s.contacts, contactForCurrent],
          }));

          return true;
        }

        // Otherwise create pending request
        const request: FriendRequest = {
          id: uid("fr"),
          fromUserId: fromUser.id,
          fromUsername: fromUser.username,
          fromDisplayName: fromUser.displayName,
          toUserId: toUser.id,
          toUsername: toUser.username,
          status: "pending",
          credential,
          createdAt: Date.now(),
        };

        set((s) => ({
          friendRequests: [...s.friendRequests, request],
        }));

        return true;
      },

      approveFriendRequest: (requestId: string) => {
        const state = get();
        const request = state.friendRequests.find((r) => r.id === requestId);
        if (!request || request.status !== "pending") return;

        // Update request status
        set((s) => ({
          friendRequests: s.friendRequests.map((r) =>
            r.id === requestId ? { ...r, status: "approved" as const } : r,
          ),
        }));

        // Add to contacts for both users
        const fromRegistered = state.registeredUsers.find(
          (u) => u.id === request.fromUserId,
        );
        const toRegistered = state.registeredUsers.find(
          (u) => u.id === request.toUserId,
        );

        if (fromRegistered && toRegistered) {
          const fromContact: User = {
            id: fromRegistered.id,
            username: fromRegistered.username,
            displayName: fromRegistered.displayName,
            avatar: "",
            publicKey: fromRegistered.publicKey,
            isOnline: false,
            sponsorRole: fromRegistered.sponsorRole,
          };

          const toContact: User = {
            id: toRegistered.id,
            username: toRegistered.username,
            displayName: toRegistered.displayName,
            avatar: "",
            publicKey: toRegistered.publicKey,
            isOnline: false,
            sponsorRole: toRegistered.sponsorRole,
          };

          // Create chat between them
          const chatId = uid("chat");
          const newChat: Chat = {
            id: chatId,
            name: toRegistered.displayName,
            avatar: "",
            lastMessage: undefined,
            lastMessageTime: undefined,
            unread: 0,
            isVerified: true,
          };

          set((s) => ({
            contacts: s.contacts.some((c) => c.id === fromContact.id)
              ? s.contacts
              : [...s.contacts, fromContact],
            chats: s.chats.some((c) => c.id === newChat.id)
              ? s.chats
              : [newChat, ...s.chats],
          }));

          // Also add the current user as a contact to the other side when they come online
          // (For simplicity we just add locally — in a real app this would sync)
          if (state.currentUser?.id === request.fromUserId) {
            set((s) => ({
              contacts: s.contacts.some((c) => c.id === toContact.id)
                ? s.contacts
                : [...s.contacts, toContact],
            }));
          }
        }
      },

      rejectFriendRequest: (requestId: string) => {
        set((s) => ({
          friendRequests: s.friendRequests.map((r) =>
            r.id === requestId ? { ...r, status: "rejected" as const } : r,
          ),
        }));
      },

      setAutoApprove: (enabled: boolean, credential: string) => {
        set({
          autoApproveSettings: {
            enabled,
            requiredCredential: enabled ? credential : "",
          },
        });
      },

      getPendingFriendRequests: () => {
        const state = get();
        const currentUser = state.currentUser;
        if (!currentUser) return [];
        return state.friendRequests.filter(
          (r) => r.toUserId === currentUser.id && r.status === "pending",
        );
      },

      // ══════════════════════════════════════════════════════════════════
      // NEW MERGE ACTIONS
      // ══════════════════════════════════════════════════════════════════

      generateMergeCode: () => {
        const code = "MERGE-" + randomSuffix(8).toUpperCase();
        set({ mergeCode: code });
        return code;
      },

      mergeAccounts: (mergeCode: string) => {
        const state = get();
        const currentUser = state.currentUser;
        if (!currentUser || !state.mergeCode) return false;
        if (state.mergeCode !== mergeCode) return false;

        // Find all accounts linked to the current user
        const primaryUsername = currentUser.username;

        // Look for another unmerged user to merge into this one
        const unmerged = state.registeredUsers.filter(
          (u) =>
            u.id !== currentUser.id &&
            !u.mergedInto &&
            u.username !== primaryUsername,
        );

        if (unmerged.length === 0) return false;

        // Merge the first unmerged account into the primary
        const accountToMerge = unmerged[0];

        // Mark the merged account
        set((s) => ({
          registeredUsers: s.registeredUsers.map((u) =>
            u.id === accountToMerge.id
              ? { ...u, mergedInto: primaryUsername }
              : u,
          ),
          // Merge chats: add any chats from the merged account's messages
          // (messages are keyed by chatId, so we keep all existing)
          mergeCode: "",
        }));

        // Move messages from the merged account's chats if they don't exist
        // For simplicity, we just keep the existing messages
        return true;
      },

      getAccountUsernames: () => {
        const state = get();
        const currentUser = state.currentUser;
        if (!currentUser) return [];

        const primaryUsername = currentUser.username;
        const merged: string[] = [primaryUsername];

        // Find all accounts that merged into this one
        for (const user of state.registeredUsers) {
          if (
            user.username !== primaryUsername &&
            user.mergedInto === primaryUsername &&
            !merged.includes(user.username)
          ) {
            merged.push(user.username);
          }
        }

        // Also check if current user itself is merged into another
        const currentRegistered = state.registeredUsers.find(
          (u) => u.id === currentUser.id,
        );
        if (currentRegistered?.mergedInto) {
          const primary = state.registeredUsers.find(
            (u) => u.username === currentRegistered.mergedInto,
          );
          if (primary && !merged.includes(primary.username)) {
            merged.unshift(primary.username);
          }
          // Find siblings
          for (const user of state.registeredUsers) {
            if (
              user.mergedInto === currentRegistered.mergedInto &&
              !merged.includes(user.username)
            ) {
              merged.push(user.username);
            }
          }
        }

        return merged;
      },

      dissolveMerge: (targetUsername: string) => {
        const state = get();
        const currentUser = state.currentUser;
        if (!currentUser) return false;

        // Case 1: Current user is primary, dissolving a merged account
        const target = state.registeredUsers.find(
          (u) =>
            u.username === targetUsername &&
            u.mergedInto === currentUser.username,
        );
        if (target) {
          set((s) => ({
            registeredUsers: s.registeredUsers.map((u) =>
              u.username === targetUsername
                ? { ...u, mergedInto: undefined }
                : u,
            ),
          }));
          return true;
        }

        // Case 2: Current user is a merged account, dissolving itself
        const currentRegistered = state.registeredUsers.find(
          (u) => u.id === currentUser.id,
        );
        if (
          currentRegistered?.mergedInto &&
          currentRegistered.username === targetUsername
        ) {
          set((s) => ({
            registeredUsers: s.registeredUsers.map((u) =>
              u.username === targetUsername
                ? { ...u, mergedInto: undefined }
                : u,
            ),
          }));
          return true;
        }

        return false;
      },

      // ══════════════════════════════════════════════════════════════════
      // NEW HELPERS
      // ══════════════════════════════════════════════════════════════════

      getUserByUsername: (username: string) => {
        return get().registeredUsers.find((u) => u.username === username);
      },

      isUsernameRegistered: (username: string) => {
        return get().registeredUsers.some((u) => u.username === username);
      },
    }),
    {
      name: "sechat-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        chats: state.chats,
        messages: state.messages,
        contacts: state.contacts,
        groups: state.groups,
        registeredUsers: state.registeredUsers,
        friendRequests: state.friendRequests,
        autoApproveSettings: state.autoApproveSettings,
        securityLevel: state.securityLevel,
        selfDestructTimer: state.selfDestructTimer,
        biometricEnabled: state.biometricEnabled,
        callState: state.callState,
      }),
    },
  ),
);

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

/** Convert ArrayBuffer to Base64URL string */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Convert Base64URL string to ArrayBuffer */
function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Convert ArrayBuffer to Base32 string (RFC 4648) */
function arrayBufferToBase32(buffer: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return result;
}
