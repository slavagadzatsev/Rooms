import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addNotificationResponseListener,
  registerPushToken,
  unregisterPushToken,
  requestNotificationPermission,
} from '../services/pushNotificationService';
import { navigate } from '../utils/navigationRef';
import { initialRooms, roomIconBackgrounds, ROOM_MEMBERS, TAG_CATEGORIES } from '../data/mockRooms';
import { getCurrentSession, signOut as signOutWithSupabase } from '../services/authService';
import {
  deleteRoomMessage as deleteRemoteRoomMessage,
  fetchRoomMessages as fetchRemoteRoomMessages,
  reactToRoomMessage as reactToRemoteRoomMessage,
  sendRoomMessage as sendRemoteRoomMessage,
  subscribeToRoomMessages as subscribeToRemoteRoomMessages,
} from '../services/messagesService';
import {
  createNotification as createRemoteNotification,
  fetchNotificationPreferences as fetchRemoteNotificationPreferences,
  fetchNotifications as fetchRemoteNotifications,
  markAllNotificationsRead as markAllRemoteNotificationsRead,
  markNotificationRead as markRemoteNotificationRead,
  subscribeToNotifications as subscribeToRemoteNotifications,
  upsertNotificationPreferences as upsertRemoteNotificationPreferences,
} from '../services/notificationsService';
import {
  fetchFollowedUsers,
  fetchProfile,
  followUser as followRemoteUser,
  replaceProfileInterests,
  unfollowUser as unfollowRemoteUser,
  upsertProfile,
} from '../services/profileService';
import {
  addRoomRole as addRemoteRoomRole,
  chooseRoomRole as chooseRemoteRoomRole,
  createRoom as createRemoteRoom,
  deleteRoom as deleteRemoteRoom,
  fetchRoom as fetchRemoteRoom,
  fetchRecommendedRooms as fetchRemoteRooms,
  inviteUserToRoom as inviteRemoteUserToRoom,
  joinRoom as joinRemoteRoom,
  leaveRoom as leaveRemoteRoom,
  pulseRoom as pulseRemoteRoom,
  subscribeToRoomUpdates as subscribeToRemoteRoomUpdates,
  updateRoomRoleColor as updateRemoteRoomRoleColor,
} from '../services/roomsService';
import { createReport as createRemoteReport } from '../services/moderationService';
import { deleteAccount as remoteDeleteAccount } from '../services/accountService';
import { getSupabaseStatus, supabase } from '../services/supabaseClient';
import { getPulseGoal } from '../utils/roomUtils';

// ─── Storage keys ────────────────────────────────────────────────────────────
const KEYS = {
  theme:         '@rooms/theme',
  profile:       '@rooms/profile',
  profileTags:   '@rooms/profileTags',
  isLoggedIn:    '@rooms/isLoggedIn',
  hasOnboarded:  '@rooms/hasOnboarded',
  hasNickname:   '@rooms/hasNickname',
  backendUserId: '@rooms/backendUserId',
  readNotifIds:  '@rooms/readNotifIds',
  followedUsers: '@rooms/followedUsers',
  blockedUsers: '@rooms/blockedUsers',
  reports: '@rooms/reports',
  rooms:         '@rooms/rooms',
  roomMessages:  '@rooms/roomMessages',
  notifications: '@rooms/notifications',
  notificationPrefs: '@rooms/notificationPrefs',
  premiumSettings: '@rooms/premiumSettings',
};

// ─── Static seed data ─────────────────────────────────────────────────────────
const INITIAL_NOTIFICATIONS = [
  { id: 1, avatar: 'AL', avatarColor: '#c9b6f8', avatarText: '#3C3489', type: '💬', typeBg: '#6B5CE7', title: 'Alina posted in a room', room: 'Looking for a Steam game team', roomColor: '#6B5CE7', roomId: '1', desc: "Hey everyone! Let's discuss the concept...", time: '10:27', section: 'new' },
  { id: 2, avatar: 'IG', avatarColor: '#9FE1CB', avatarText: '#085041', type: '👥', typeBg: '#f59e0b', title: 'Igor invited you to a room', room: 'Online course creators', roomColor: '#f59e0b', roomId: '7', desc: 'Join the discussion!', time: 'Yesterday', section: 'new' },
  { id: 3, avatar: 'KT', avatarColor: '#d8b4fe', avatarText: '#7e22ce', type: '@', typeBg: '#22c55e', title: 'Kate mentioned you', room: 'Music project', roomColor: '#22c55e', roomId: '4', desc: '@you what do you think about this format?', time: 'Yesterday', section: 'new' },
  { id: 4, avatar: 'DN', avatarColor: '#B4B2A9', avatarText: '#2C2C2A', type: '❤️', typeBg: '#ef4444', title: 'Daniel liked your message', desc: "Thanks for the idea! Let's try it.", time: '2 days ago', section: 'old' },
  { id: 5, avatar: 'MI', avatarColor: '#fde68a', avatarText: '#633806', type: '👤', typeBg: '#3b82f6', title: 'Mike followed you', desc: "You can now see each other's activity.", time: '3 days ago', section: 'old' },
  { id: 6, avatar: '🔔', avatarColor: '#ede9ff', avatarText: '#6B5CE7', type: '🔔', typeBg: '#6B5CE7', title: 'Reminder', desc: 'Room Fintech startup team expires in 2 days.', roomId: '5', time: '3 days ago', section: 'old' },
  { id: 7, avatar: 'JR', avatarColor: '#c9b6f8', avatarText: '#3C3489', type: '✓', typeBg: '#22c55e', title: 'Your request was accepted', desc: 'You were added to Open source web app', roomId: '6', time: '5 days ago', section: 'old' },
];

const INITIAL_ROOM_MESSAGES = {
  '1': [
    { id: 'm1', sender: 'Alina', color: '#c9b6f8', textColor: '#3C3489', text: "Hey everyone! Let's discuss the concept of our game and split up the tasks.", time: '10:23', mine: false, reaction: '👍 3' },
    { id: 'm2', sender: 'Igor', color: '#9FE1CB', textColor: '#085041', text: "Hey! I've already sketched out the core survival and crafting mechanics. Can share later.", time: '10:25', mine: false, reaction: '🔥 2' },
    { id: 'm3', sender: 'Me', color: '#6B5CE7', textColor: '#fff', text: "Nice! I'll work on the world and character description doc today.", time: '10:27', mine: true, reaction: '🚀 2' },
    { id: 'm4', sender: 'Kate', color: '#d8b4fe', textColor: '#7e22ce', text: 'I can make some concept art for locations. What style do you prefer?', time: '10:30', mine: false, reaction: '' },
    { id: 'm5', sender: 'Alex', color: '#fde68a', textColor: '#633806', text: "Let's hop on a call tonight on Discord? We can talk through everything.", time: '10:31', mine: false, reaction: '✅ 1' },
  ],
  '4': [
    { id: 'm1', sender: 'Vika', color: '#d8b4fe', textColor: '#7e22ce', text: 'Should we extend the room? We still have so much to do 🎵', time: '11:00', mine: false, reaction: '' },
    { id: 'm2', sender: 'Me', color: '#6B5CE7', textColor: '#fff', text: "Agreed, let's go for another 2 weeks!", time: '11:02', mine: true, reaction: '✅ 3' },
  ],
  '6': [
    { id: 'm1', sender: 'Tom', color: '#9FE1CB', textColor: '#085041', text: 'Here is the solution to task #12. Let me know what you think.', time: '09:15', mine: false, reaction: '👍 2' },
  ],
};

const INITIAL_PROFILE = {
  name: 'Rumo user',
  bio: '',
  location: '',
  avatarUri: null,
};

const INITIAL_PROFILE_TAGS = [];

const ROLE_COLOR_PALETTE = ['#7C5CFC', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

function getDefaultRoleColors(roles = []) {
  return Object.fromEntries(
    roles.map((role, index) => [role, ROLE_COLOR_PALETTE[index % ROLE_COLOR_PALETTE.length]])
  );
}

function parseReactionSummary(summary = '') {
  if (Array.isArray(summary)) return summary;
  const parts = String(summary || '').trim().split(/\s+/).filter(Boolean);
  const reactions = [];
  for (let i = 0; i < parts.length; i += 2) {
    const emoji = parts[i];
    const count = Number(parts[i + 1] || 1);
    if (emoji) reactions.push({ emoji, count: Number.isFinite(count) ? count : 1 });
  }
  return reactions;
}

function formatReactionSummary(reactions = []) {
  return reactions
    .filter(item => item?.emoji && item.count > 0)
    .map(item => `${item.emoji} ${item.count}`)
    .join(' ');
}

function toggleReactionSummary(summary, emoji) {
  const reactions = parseReactionSummary(summary);
  const index = reactions.findIndex(item => item.emoji === emoji);
  if (index >= 0) {
    const nextCount = reactions[index].count - 1;
    if (nextCount <= 0) reactions.splice(index, 1);
    else reactions[index] = { ...reactions[index], count: nextCount };
  } else {
    reactions.push({ emoji, count: 1 });
  }
  return formatReactionSummary(reactions);
}

const CATEGORY_KEY_BY_LABEL = Object.fromEntries(
  TAG_CATEGORIES.map(category => [category.label.toLowerCase(), category.key])
);

function toStableTagId(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '');
}

function getStableProfileTagId(tag) {
  const name = String(tag?.name || '').trim();
  const categoryKey = CATEGORY_KEY_BY_LABEL[name.toLowerCase()];
  if (categoryKey) return categoryKey;

  const rawId = String(tag?.id || '').trim();
  const looksLikeGeneratedId = /^[0-9a-f]{8}-[0-9a-f-]{13,}$/i.test(rawId);
  if (rawId && !looksLikeGeneratedId) return rawId;

  return toStableTagId(name || rawId || 'interest');
}

function normalizeProfileTags(tags = []) {
  const byId = new Map();

  tags.forEach(tag => {
    if (!tag?.name) return;
    const id = getStableProfileTagId(tag);
    const existing = byId.get(id);
    const focusTags = [...new Set([...(existing?.focusTags || []), ...(tag.focusTags || [])].filter(Boolean))];
    const keywords = [...new Set([...(existing?.keywords || []), ...(tag.keywords || [])].filter(Boolean))];

    byId.set(id, {
      ...existing,
      ...tag,
      id,
      name: existing?.name || tag.name,
      color: existing?.color || tag.color || '#6B5CE7',
      desc: tag.desc || existing?.desc || '',
      focusTags,
      keywords,
    });
  });

  return Array.from(byId.values());
}

const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  messages: true,
  mentions: true,
  invites: true,
  roomActivity: true,
  roomExpiry: true,
};

const DEFAULT_PREMIUM_SETTINGS = {
  profileCardBg: null,   // full card background tint for profile (null = default glass)
  roomCardBg: null,      // full card background tint for rooms created by this user
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function load(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function save(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}


function withPulseDefaults(room) {
  const seededPulseRoom  = room.id === '4' && room.daysLeft === undefined;
  const seededPulsedRoom = room.id === '6' && room.daysLeft === undefined;
  const seededExpiredRoom = room.id === '5' && room.daysLeft === undefined;
  const daysLeft   = seededExpiredRoom ? 0 : seededPulseRoom ? 2 : seededPulsedRoom ? 3 : (room.daysLeft ?? room.lifetime ?? 14);
  const seededGoal = seededPulseRoom ? 4 : seededPulsedRoom ? 2 : undefined;
  const members    = room.members ?? ROOM_MEMBERS[room.id] ?? [];
  const firstMember = ROOM_MEMBERS[room.id]?.[0];
  const defaultRoles = room.roomRoles ?? Array.from(new Set(members.map(member => member.role).filter(Boolean)));
  const finalRoles = defaultRoles.length > 0 ? defaultRoles : ['Member'];
  return {
    ...room,
    daysLeft,
    pulseGoal:   room.pulseGoal   ?? seededGoal ?? getPulseGoal(room.maxMembers ?? room.membersCount),
    pulseCount:  room.pulseCount  ?? (seededPulseRoom ? 2 : seededPulsedRoom ? 1 : 0),
    hasPulsed:   room.hasPulsed   ?? seededPulsedRoom,
    aliveStreak: room.aliveStreak ?? (seededPulseRoom ? 1 : 0),
    members,
    roomRoles: finalRoles,
    roleColors: { ...getDefaultRoleColors(finalRoles), ...(room.roleColors || {}) },
    createdBy: room.createdBy ?? firstMember?.name ?? 'Unknown',
  };
}

function getMemberKey(member) {
  if (member?.backendUserId) return member.backendUserId;
  if (member?.id && !String(member.id).startsWith('me')) return String(member.id);
  return `${member?.name || 'unknown'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getMentionedRoomMembers(text = '', members = [], currentUserId = null) {
  const normalizedText = ` ${String(text || '').toLowerCase()} `;
  const seen = new Set();
  return (members || []).filter(member => {
    const targetId = member?.backendUserId || (!String(member?.id || '').startsWith('me') ? member?.id : null);
    if (!targetId || targetId === currentUserId || seen.has(targetId)) return false;
    const cleanName = String(member?.name || '').trim().toLowerCase();
    if (!cleanName || cleanName === 'me') return false;
    const compactName = cleanName.replace(/\s+/g, '');
    const isMentioned = normalizedText.includes(`@${cleanName} `)
      || normalizedText.includes(`@${compactName} `);
    if (isMentioned) seen.add(targetId);
    return isMentioned;
  });
}

function getInitials(name = 'Rumo') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'RM';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function getBackendRoomId(rooms, roomId) {
  const room = rooms.find(item => item.id === roomId || item.backendRoomId === roomId);
  if (room?.backendRoomId) return room.backendRoomId;
  return isUuid(room?.id || roomId) ? (room?.id || roomId) : null;
}

function getLocalRoomId(rooms, backendRoomId) {
  return rooms.find(room => room.backendRoomId === backendRoomId)?.id || backendRoomId;
}

function getBackendMessageId(roomMessages, roomId, msgId) {
  return (roomMessages[roomId] || []).find(message => message.id === msgId)?.backendMessageId || null;
}

function mergeRoomLocalState(remoteRoom, localRoom) {
  if (!localRoom) return remoteRoom;
  return {
    ...remoteRoom,
    checkedInToday: localRoom.checkedInToday ?? remoteRoom.checkedInToday,
    activeToday: Math.max(remoteRoom.activeToday ?? 0, localRoom.activeToday ?? 0),
    isSaved: localRoom.isSaved ?? remoteRoom.isSaved,
  };
}

function isNotificationAllowed(prefs, eventType) {
  if (!prefs.enabled) return false;
  if (eventType === 'mention') return prefs.mentions;
  if (eventType === 'message_sent') return prefs.messages;
  if (eventType === 'invite') return prefs.invites;
  if (eventType === 'room_expiring') return prefs.roomExpiry;
  if (['member_joined', 'role_changed', 'room_revived', 'pulse_needed'].includes(eventType)) {
    return prefs.roomActivity;
  }
  return true;
}

function hasRealProfileName(profile) {
  const name = profile?.name?.trim();
  return !!name && name !== 'Rooms user' && name !== 'Rumo user' && name !== 'Guest';
}

function getAuthDisplayName(user) {
  const meta = user?.user_metadata || {};
  return (
    meta.name ||
    meta.full_name ||
    meta.preferred_username ||
    user?.email?.split('@')?.[0] ||
    ''
  ).trim();
}

function mergeProfilePreservingLocal(localProfile, remoteProfile, { keepLocalName = false } = {}) {
  if (!remoteProfile) return localProfile;
  const local = localProfile || INITIAL_PROFILE;
  return {
    ...local,
    ...remoteProfile,
    name: keepLocalName && hasRealProfileName(local) ? local.name : (remoteProfile.name || local.name),
    bio: remoteProfile.bio || local.bio || '',
    location: remoteProfile.location || local.location || '',
    avatarUri: remoteProfile.avatarUri || local.avatarUri || null,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext({});

export function AppProvider({ children }) {
  // ── Hydration flag ──────────────────────────────────────────────────────────
  const [storageReady, setStorageReady] = useState(false);
  const [backendUserId, setBackendUserId] = useState(null);

  // ── State ───────────────────────────────────────────────────────────────────
  const [isLoggedIn,    setIsLoggedIn]    = useState(false);
  const [hasOnboarded,  setHasOnboarded]  = useState(false);
  const [hasNickname,   setHasNickname]   = useState(false);
  const [themeMode,     setThemeMode]     = useState('light');
  const [profile,       setProfile]       = useState(INITIAL_PROFILE);
  const [profileTags,   setProfileTags]   = useState(INITIAL_PROFILE_TAGS);
  const profileTagsRef = useRef(INITIAL_PROFILE_TAGS);
  useEffect(() => { profileTagsRef.current = profileTags; }, [profileTags]);
  const [readNotifIds,  setReadNotifIds]  = useState([]);
  const [followedUserIds, setFollowedUserIds] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [reports, setReports] = useState([]);
  const [rooms,         setRooms]         = useState(initialRooms.map(withPulseDefaults));
  const [roomMessages,  setRoomMessages]  = useState(INITIAL_ROOM_MESSAGES);
  const roomMessagesRef = useRef(INITIAL_ROOM_MESSAGES);
  useEffect(() => { roomMessagesRef.current = roomMessages; }, [roomMessages]);
  // Keep refs so async callbacks (invite retry, AppState handler) always read current values
  const roomsRef = useRef(initialRooms.map(withPulseDefaults));
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  const backendUserIdRef = useRef(null);
  useEffect(() => { backendUserIdRef.current = backendUserId; }, [backendUserId]);
  // Track rooms deleted by the user so they don't reappear during remote fetches
  const deletedRoomIdsRef = useRef(new Set());
  const [localNotifications, setLocalNotifications] = useState([]);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [premiumSettings, setPremiumSettings] = useState(DEFAULT_PREMIUM_SETTINGS);
  const [remoteNotificationPrefsReady, setRemoteNotificationPrefsReady] = useState(false);

  const notifications = useMemo(() => {
    if (!notificationPrefs.enabled) return [];
    // In Supabase mode show only real notifications; in guest/local mode add seeds for demo
    if (backendUserId) return localNotifications;
    return [...localNotifications, ...INITIAL_NOTIFICATIONS];
  }, [localNotifications, notificationPrefs.enabled, backendUserId]);

  // ── Load from storage once on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [
        savedTheme,
        savedProfile,
        savedTags,
        savedLoggedIn,
        savedOnboarded,
        savedHasNickname,
        savedBackendUserId,
        savedReadIds,
        savedFollowedIds,
        savedBlockedIds,
        savedReports,
        savedRooms,
        savedMessages,
        savedNotifications,
        savedNotificationPrefs,
        savedPremiumSettings,
      ] = await Promise.all([
        load(KEYS.theme,        'light'),
        load(KEYS.profile,      INITIAL_PROFILE),
        load(KEYS.profileTags,  INITIAL_PROFILE_TAGS),
        load(KEYS.isLoggedIn,   false),
        load(KEYS.hasOnboarded, false),
        load(KEYS.hasNickname,  false),
        load(KEYS.backendUserId, null),
        load(KEYS.readNotifIds, []),
        load(KEYS.followedUsers, []),
        load(KEYS.blockedUsers, []),
        load(KEYS.reports, []),
        load(KEYS.rooms,        initialRooms.map(withPulseDefaults)),
        load(KEYS.roomMessages, INITIAL_ROOM_MESSAGES),
        load(KEYS.notifications, []),
        load(KEYS.notificationPrefs, DEFAULT_NOTIFICATION_PREFS),
        load(KEYS.premiumSettings, DEFAULT_PREMIUM_SETTINGS),
      ]);

      setThemeMode(savedTheme);
      setProfile(savedProfile);
      setProfileTags(normalizeProfileTags(savedTags));
      setIsLoggedIn(savedLoggedIn);
      setHasOnboarded(savedOnboarded);
      setHasNickname(savedHasNickname);
      setBackendUserId(savedBackendUserId);
      setReadNotifIds(savedReadIds);
      setFollowedUserIds(savedFollowedIds);
      setBlockedUserIds(savedBlockedIds);
      setReports(savedReports);
      setRooms(savedRooms.map(withPulseDefaults));
      setRoomMessages(savedMessages);
      setLocalNotifications(savedNotifications);
      setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...savedNotificationPrefs });
      setPremiumSettings({ ...DEFAULT_PREMIUM_SETTINGS, ...savedPremiumSettings });
      if (getSupabaseStatus().configured) {
        try {
          const session = await getCurrentSession();
          const userId = session?.user?.id || null;
          if (userId) {
            setBackendUserId(userId);
            setIsLoggedIn(true);
            const remote = await fetchProfile(userId);
            if (remote.profile) {
              setProfile(prev => {
                const keepLocalName = savedHasNickname && hasRealProfileName(prev);
                return mergeProfilePreservingLocal(prev, remote.profile, { keepLocalName });
              });
              if (hasRealProfileName(remote.profile)) setHasNickname(true);
            } else {
              const authName = getAuthDisplayName(session.user);
              if (authName && !savedHasNickname) setProfile(prev => ({ ...prev, name: authName }));
            }
            if (remote.interests.length > 0) {
              setProfileTags(normalizeProfileTags(remote.interests));
              setHasOnboarded(true);
            } else {
              const localTags = normalizeProfileTags(savedTags);
              if (localTags.length > 0) {
                setHasOnboarded(true);
                replaceProfileInterests(userId, localTags).catch(() => {});
              }
            }
          }
        } catch {}
      }
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!getSupabaseStatus().configured || !supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const userId = session?.user?.id || null;
      setBackendUserId(userId);
      setIsLoggedIn(Boolean(userId));
      if (!userId) return;
      try {
        const remote = await fetchProfile(userId);
        if (remote.profile) {
          setProfile(prev => {
            const keepLocalName = hasRealProfileName(prev) && prev.name !== 'Guest';
            return mergeProfilePreservingLocal(prev, remote.profile, { keepLocalName });
          });
          if (hasRealProfileName(remote.profile)) setHasNickname(true);
        } else {
          const authName = getAuthDisplayName(session.user);
          if (authName) setProfile(prev => hasRealProfileName(prev) ? prev : ({ ...prev, name: authName }));
        }
        if (remote.interests.length > 0) {
          setProfileTags(normalizeProfileTags(remote.interests));
          setHasOnboarded(true);
        } else {
          const localTags = normalizeProfileTags(profileTagsRef.current);
          if (localTags.length > 0) {
            setHasOnboarded(true);
            replaceProfileInterests(userId, localTags).catch(() => {});
          }
        }
      } catch {}
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // ── Persist on change (only after hydration) ────────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.theme, themeMode);
  }, [themeMode, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.profile, profile);
    if (backendUserId && getSupabaseStatus().configured) {
      upsertProfile(backendUserId, profile)
        .then(updated => {
          // If avatar was uploaded to Storage and the URL changed (local → remote),
          // persist the public URL so we don't re-upload the same file on every save.
          if (updated?.avatarUri && updated.avatarUri !== profile.avatarUri) {
            setProfile(prev => ({ ...prev, avatarUri: updated.avatarUri }));
          }
        })
        .catch(() => {});
    }
  }, [profile, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    const normalizedTags = normalizeProfileTags(profileTags);
    save(KEYS.profileTags, normalizedTags);
    if (backendUserId && getSupabaseStatus().configured) {
      replaceProfileInterests(backendUserId, normalizedTags).catch(() => {});
    }
  }, [profileTags, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.isLoggedIn, isLoggedIn);
  }, [isLoggedIn, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.hasOnboarded, hasOnboarded);
  }, [hasOnboarded, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.hasNickname, hasNickname);
  }, [hasNickname, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.backendUserId, backendUserId);
  }, [backendUserId, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.readNotifIds, readNotifIds);
  }, [readNotifIds, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.followedUsers, followedUserIds);
  }, [followedUserIds, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.blockedUsers, blockedUserIds);
  }, [blockedUserIds, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.reports, reports);
  }, [reports, storageReady]);

  // Always persist rooms so checkedInToday and isSaved survive restarts.
  // mergeRoomLocalState() preserves these fields when Supabase data is loaded on startup.
  // Debounced so rapid state changes (incoming messages, unread counts) don't flood AsyncStorage.
  useEffect(() => {
    if (!storageReady) return;
    const timer = setTimeout(() => save(KEYS.rooms, rooms), 800);
    return () => clearTimeout(timer);
  }, [rooms, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    if (backendUserId && getSupabaseStatus().configured) return;
    save(KEYS.roomMessages, roomMessages);
  }, [roomMessages, storageReady, backendUserId]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.notifications, localNotifications);
  }, [localNotifications, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.notificationPrefs, notificationPrefs);
    if (backendUserId && getSupabaseStatus().configured && remoteNotificationPrefsReady) {
      upsertRemoteNotificationPreferences(backendUserId, notificationPrefs).catch(() => {});
    }
  }, [notificationPrefs, storageReady, backendUserId, remoteNotificationPrefsReady]);

  useEffect(() => {
    if (!storageReady) return;
    save(KEYS.premiumSettings, premiumSettings);
  }, [premiumSettings, storageReady]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storageReady || !backendUserId || !getSupabaseStatus().configured) return;
    let cancelled = false;
    (async () => {
      try {
        const remoteRooms = await fetchRemoteRooms({
          profileInterests: profileTags,
          userId: backendUserId,
          limit: 50,
        });
        // When logged in, always use real data — even if empty (don't show mock rooms)
        if (!cancelled) {
          setRooms(prev => remoteRooms
            .filter(remoteRoom => !deletedRoomIdsRef.current.has(remoteRoom.backendRoomId))
            .map(remoteRoom =>
              withPulseDefaults(mergeRoomLocalState(remoteRoom, prev.find(room =>
                room.id === remoteRoom.id || room.backendRoomId === remoteRoom.backendRoomId
              )))
            )
          );
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUserId, storageReady]);

  const loadNotifications = async () => {
    if (!backendUserId || !getSupabaseStatus().configured) return [];
    try {
      const remoteNotifications = await fetchRemoteNotifications(backendUserId);
      const mapped = remoteNotifications.map(notification => ({
        ...notification,
        roomId: notification.roomId ? getLocalRoomId(rooms, notification.roomId) : notification.roomId,
      }));
      setLocalNotifications(mapped);
      setReadNotifIds(prev => Array.from(new Set([
        ...prev,
        ...mapped.filter(notification => notification.readAt).map(notification => notification.id),
      ])));
      return mapped;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (!storageReady || !backendUserId || !getSupabaseStatus().configured) return undefined;
    loadNotifications();
    const subscription = subscribeToRemoteNotifications(backendUserId, loadNotifications);
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') {
        loadNotifications().catch(() => {});
      }
    }, 15000);
    return () => {
      subscription?.unsubscribe?.();
      clearInterval(intervalId);
    };
  }, [backendUserId, storageReady]);

  // Refresh rooms (+ member profiles) and followed users when app comes back to foreground.
  // Uses refs to avoid stale closure values. 30-second cooldown prevents double-fetches on
  // rapid foreground transitions (biometric prompt, notification tap, etc).
  const lastForegroundRefetchRef = useRef(0);
  useEffect(() => {
    if (!storageReady) return undefined;
    const subscription = AppState.addEventListener('change', nextState => {
      const userId = backendUserIdRef.current;
      if (nextState !== 'active' || !userId || !getSupabaseStatus().configured) return;
      const now = Date.now();
      if (now - lastForegroundRefetchRef.current < 30000) return;
      lastForegroundRefetchRef.current = now;
      fetchRemoteRooms({ profileInterests: profileTagsRef.current, userId, limit: 50 })
        .then(remoteRooms => {
          setRooms(prev => remoteRooms
            .filter(remoteRoom => !deletedRoomIdsRef.current.has(remoteRoom.backendRoomId))
            .map(remoteRoom =>
              withPulseDefaults(mergeRoomLocalState(remoteRoom, prev.find(room =>
                room.id === remoteRoom.id || room.backendRoomId === remoteRoom.backendRoomId
              )))
            )
          );
        })
        .catch(() => {});
      fetchFollowedUsers(userId)
        .then(remoteFollows => {
          setFollowedUsers(remoteFollows);
          setFollowedUserIds(remoteFollows.map(u => u.id));
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, [storageReady]);

  useEffect(() => {
    if (!storageReady || !backendUserId || !getSupabaseStatus().configured) {
      setRemoteNotificationPrefsReady(false);
      return;
    }
    let cancelled = false;
    setRemoteNotificationPrefsReady(false);
    (async () => {
      try {
        const remotePrefs = await fetchRemoteNotificationPreferences(backendUserId);
        if (!cancelled && remotePrefs) {
          setNotificationPrefs(prev => ({ ...DEFAULT_NOTIFICATION_PREFS, ...prev, ...remotePrefs }));
        }
      } catch {
      } finally {
        if (!cancelled) setRemoteNotificationPrefsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backendUserId, storageReady]);

  useEffect(() => {
    if (!storageReady || !backendUserId || !getSupabaseStatus().configured) return;
    (async () => {
      try {
        const remoteFollows = await fetchFollowedUsers(backendUserId);
        setFollowedUsers(remoteFollows);
        setFollowedUserIds(remoteFollows.map(user => user.id));
      } catch {}
    })();
  }, [backendUserId, storageReady]);

  // ── Push notification token ───────────────────────────────────────────────
  useEffect(() => {
    if (!storageReady || !backendUserId) return;
    registerPushToken(backendUserId);
  }, [backendUserId, storageReady]);

  // Navigate to a room when the user taps a push notification
  useEffect(() => {
    const sub = addNotificationResponseListener(response => {
      const data = response?.notification?.request?.content?.data;
      if (data?.roomId) {
        navigate('Main', {
          screen: 'Home',
          params: { screen: 'Room', params: { roomId: String(data.roomId) } },
        });
      }
    });
    return () => sub?.remove?.();
  }, []);

  const login  = (user = null) => {
    if (user?.id) setBackendUserId(user.id);
    const authName = getAuthDisplayName(user);
    if (authName) setProfile(prev => hasRealProfileName(prev) ? prev : ({ ...prev, name: authName }));
    setIsLoggedIn(true);
  };
  const logout = () => {
    if (backendUserId && getSupabaseStatus().configured) {
      unregisterPushToken(backendUserId).catch(() => {});
      signOutWithSupabase().catch(() => {});
    }
    // Clear persisted storage so next launch starts clean
    AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => {});
    setBackendUserId(null);
    setIsLoggedIn(false);
    setHasNickname(false);
    // Reset all in-memory state back to defaults
    setProfile(INITIAL_PROFILE);
    setProfileTags(normalizeProfileTags(INITIAL_PROFILE_TAGS));
    setRooms(initialRooms.map(withPulseDefaults));
    setRoomMessages(INITIAL_ROOM_MESSAGES);
    setReadNotifIds([]);
    setFollowedUserIds([]);
    setFollowedUsers([]);
    setBlockedUserIds([]);
    setReports([]);
    setLocalNotifications([]);
    setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
    setPremiumSettings({});
  };
  const deleteAccount = async () => {
    const userId = backendUserId;
    if (userId && getSupabaseStatus().configured) {
      unregisterPushToken(userId).catch(() => {});
      await remoteDeleteAccount().catch(() => {});
    }
    // Clear all persisted storage so next launch starts completely fresh
    AsyncStorage.multiRemove(Object.values(KEYS)).catch(() => {});
    setBackendUserId(null);
    setIsLoggedIn(false);
    setHasOnboarded(false);
    setHasNickname(false);
    setThemeMode('light');
    setProfile(INITIAL_PROFILE);
    setProfileTags(normalizeProfileTags(INITIAL_PROFILE_TAGS));
    setReadNotifIds([]);
    setFollowedUserIds([]);
    setFollowedUsers([]);
    setBlockedUserIds([]);
    setReports([]);
    setRooms(initialRooms.map(withPulseDefaults));
    setRoomMessages(INITIAL_ROOM_MESSAGES);
    setLocalNotifications([]);
    setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
    setPremiumSettings(DEFAULT_PREMIUM_SETTINGS);
    setRemoteNotificationPrefsReady(false);
  };
  const finishOnboarding = () => setHasOnboarded(true);
  const finishNickname = (name) => {
    const clean = String(name || '').trim();
    if (clean.length < 2) return false;
    setProfile(prev => ({ ...prev, name: clean }));
    if (backendUserId && getSupabaseStatus().configured) {
      upsertProfile(backendUserId, { ...profile, name: clean }).catch(() => {});
    }
    setHasNickname(true);
    // Request push notification permission after onboarding — natural moment,
    // user has just set up their profile. Short delay so the screen transition
    // finishes before the system dialog appears.
    setTimeout(() => requestNotificationPermission().catch(() => {}), 1200);
    return true;
  };

  const addNotification = ({ eventType, title, desc, roomId, actor, type = 'bell', typeBg = '#6B5CE7', dedupeKey }) => {
    if (!isNotificationAllowed(notificationPrefs, eventType)) return;
    const room = rooms.find(r => r.id === roomId);
    const avatarSource = actor || room?.title || 'Rumo';
    const id = `${eventType}-${roomId || 'app'}-${Date.now()}`;
    const nextNotification = {
      id,
      dedupeKey,
      eventType,
      avatar: getInitials(avatarSource),
      avatarColor: '#c9b6f8',
      avatarText: '#3C3489',
      type,
      typeBg,
      title,
      room: room?.title,
      roomColor: '#6B5CE7',
      roomId,
      desc,
      time: 'Just now',
      createdAt: new Date().toISOString(),
      section: 'new',
    };
    setLocalNotifications(prev => {
      if (dedupeKey && prev.some(n => n.dedupeKey === dedupeKey)) return prev;
      return [nextNotification, ...prev].slice(0, 40);
    });
    if (backendUserId && getSupabaseStatus().configured) {
      createRemoteNotification({
        userId: backendUserId,
        roomId: room ? getBackendRoomId(rooms, roomId) : null,
        actorId: backendUserId,
        eventType,
        dedupeKey,
        title,
        body: desc,
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!storageReady || !isNotificationAllowed(notificationPrefs, 'room_expiring')) return;
    rooms.forEach(room => {
      const daysLeft = room.daysLeft ?? room.lifetime ?? 14;
      if (!(room.isMember || room.isMine) || daysLeft <= 0 || daysLeft > 3 || room.hasPulsed) return;
      const dedupeKey = `room_expiring-${room.id}-${daysLeft}`;
      setLocalNotifications(prev => {
        if (prev.some(n => n.dedupeKey === dedupeKey)) return prev;
        return [
          {
            id: `room_expiring-${room.id}-${Date.now()}`,
            dedupeKey,
            eventType: 'room_expiring',
            avatar: getInitials(room.title),
            avatarColor: '#fde68a',
            avatarText: '#633806',
            type: 'expiry',
            typeBg: '#f59e0b',
            title: 'Room expires soon',
            room: room.title,
            roomColor: '#6B5CE7',
            roomId: room.id,
            desc: `${room.title} has ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left.`,
            time: 'Just now',
            createdAt: new Date().toISOString(),
            section: 'new',
          },
          ...prev,
        ].slice(0, 40);
      });
    });
  }, [rooms, storageReady, notificationPrefs]);

  const createRoom = (draft) => {
    const cleanRoles = Array.from(new Set((draft.roles || ['Member'])
      .map(role => String(role || '').trim())
      .filter(role => role && role.toLowerCase() !== 'creator')));
    if (cleanRoles.length === 0) cleanRoles.push('Member');
    const creatorMember = {
      id: 'me',
      name: profile.name || 'Me',
      role: 'Creator',
      color: '#6B5CE7',
      textColor: '#fff',
      online: true,
    };
    const nextRoom = {
      id: Date.now().toString(),
      createdBy: profile.name || 'Me',
      icon: draft.icon,
      imageUri: draft.imageUri || null,
      iconBg: draft.iconBg || roomIconBackgrounds[draft.icon] || '#ede9ff',
      cardBg: premiumSettings?.roomCardBg || null,
      title: draft.name.trim(),
      desc: draft.description.trim(),
      tags: Array.isArray(draft.tags) && draft.tags.length > 0 ? draft.tags : ['General'],
      country: draft.country || 'Germany',
      membersCount: 1,
      maxMembers: draft.maxMembers,
      online: 1,
      lifetime: draft.lifetime,
      daysLeft: draft.lifetime,
      pulseGoal: 1,
      pulseCount: 0,
      hasPulsed: false,
      aliveStreak: 0,
      time: 'Just now',
      createdAt: Date.now(),
      unread: 0,
      section: 'recommended',
      isMember: true,
      isMine: true,
      privacy: draft.privacy,
      language: draft.language,
      lastMsg: 'Room created. Start the conversation!',
      type: draft.type || 'project',
      checkinEnabled: draft.checkinEnabled ?? true,
      activeToday: 0,
      checkedInToday: false,
      members: [creatorMember],
      roomRoles: ['Creator', ...cleanRoles],
      roleColors: {
        ...getDefaultRoleColors(['Creator', ...cleanRoles]),
        ...(draft.roleColors || {}),
      },
    };
    setRooms(prev => [nextRoom, ...prev]);
    if (backendUserId && getSupabaseStatus().configured) {
      createRemoteRoom({ ...draft, creatorName: profile.name || 'Rumo user' }, backendUserId)
        .then(remoteId => {
          setRooms(prev => prev.map(room =>
            room.id === nextRoom.id ? { ...room, backendRoomId: remoteId } : room
          ));
          fetchRemoteRoom(remoteId, backendUserId)
            .then(remoteRoom => {
              if (!remoteRoom) return;
              setRooms(prev => prev.map(room =>
                room.id === nextRoom.id
                  ? withPulseDefaults({ ...remoteRoom, id: nextRoom.id, backendRoomId: remoteId })
                  : room
              ));
            })
            .catch(() => {});
        })
        .catch(error => {
          Alert.alert(
            'Room not synced',
            error?.message || 'The room was created only on this device. Please check your account and Supabase connection.'
          );
        });
    } else {
      Alert.alert(
        'Room saved locally',
        'You are not connected to Supabase right now. This room is only on this device, so other people will not see it.'
      );
    }
    return nextRoom;
  };

  const sendMessage = (roomId, text, replyTo = null, attachment = null) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id = `msg-${Date.now()}`;
    const cleanText = text.trim();
    const newMsg = {
      id,
      sender: 'Me',
      color: '#6B5CE7',
      textColor: '#fff',
      text: cleanText,
      time: now,
      mine: true,
      reaction: '',
      status: 'sent',
      replyTo: replyTo ? { sender: replyTo.sender, text: replyTo.text } : null,
      attachment,
    };
    setRoomMessages(prev => ({ ...prev, [roomId]: [...(prev[roomId] || []), newMsg] }));
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, lastMsg: `Me: ${cleanText || attachment?.label || 'Attachment'}`, unread: 0, time: 'Just now' } : r
    ));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      const room = rooms.find(r => r.id === roomId || r.backendRoomId === backendRoomId);
      if (!backendRoomId) {
        setRoomMessages(prev => ({
          ...prev,
          [roomId]: (prev[roomId] || []).map(msg =>
            msg.id === id ? { ...msg, status: 'failed', sendError: 'Room is still syncing. Try again in a moment.' } : msg
          ),
        }));
        return id;
      }
      sendRemoteRoomMessage(backendRoomId, cleanText, backendUserId, replyTo, attachment)
        .then(remoteId => {
          setRoomMessages(prev => {
            let foundTempMessage = false;
            const merged = (prev[roomId] || []).map(msg => {
              if (msg.id === id) {
                foundTempMessage = true;
                return { ...msg, backendMessageId: remoteId, status: 'delivered', sendError: null };
              }
              if (msg.backendMessageId === remoteId) {
                return {
                  ...msg,
                  attachment: msg.attachment || attachment,
                  status: msg.mine ? 'delivered' : msg.status,
                  sendError: null,
                };
              }
              return msg;
            });
            if (!foundTempMessage && attachment && !merged.some(msg => msg.backendMessageId === remoteId)) {
              merged.push({
                ...newMsg,
                backendMessageId: remoteId,
                status: 'delivered',
                sendError: null,
              });
            }
            return { ...prev, [roomId]: merged };
          });
          getMentionedRoomMembers(cleanText, room?.members || [], backendUserId).forEach(member => {
            const targetUserId = member.backendUserId || member.id;
            createRemoteNotification({
              userId: targetUserId,
              roomId: backendRoomId,
              actorId: backendUserId,
              eventType: 'mention',
              dedupeKey: `mention-${remoteId}-${targetUserId}`,
              title: `${profile.name || 'Someone'} mentioned you`,
              body: cleanText,
            }).catch(() => {});
          });
          loadRoomMessages(roomId).catch(() => {});
        })
        .catch(error => {
          console.warn('sendMessage failed', {
            roomId,
            backendRoomId,
            hasAttachment: Boolean(attachment?.uri),
            message: error?.message,
          });
          setRoomMessages(prev => ({
            ...prev,
            [roomId]: (prev[roomId] || []).map(msg =>
              msg.id === id ? { ...msg, status: 'failed', sendError: attachment ? (error?.message || 'Photo was not uploaded') : 'Message was not sent' } : msg
            ),
          }));
        });
    }
    return id;
  };

  const updateMessageStatus = (roomId, msgId, status) => {
    setRoomMessages(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || []).map(msg =>
        msg.id === msgId && msg.status !== 'failed'
          ? { ...msg, status, sendError: status === 'failed' ? msg.sendError : null }
          : msg
      ),
    }));
  };

  const retryMessage = (roomId, msgId) => {
    const msg = (roomMessages[roomId] || []).find(item => item.id === msgId);
    if (!msg || msg.status !== 'failed') return;

    setRoomMessages(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || []).map(item =>
        item.id === msgId ? { ...item, status: 'sent', sendError: null } : item
      ),
    }));

    if (!backendUserId || !getSupabaseStatus().configured) {
      return;
    }

    const backendRoomId = getBackendRoomId(rooms, roomId);
    if (!backendRoomId) {
      setRoomMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(item =>
          item.id === msgId ? { ...item, status: 'failed', sendError: 'Room is still syncing. Try again in a moment.' } : item
        ),
      }));
      return;
    }

      sendRemoteRoomMessage(
      backendRoomId,
      msg.text || '',
      backendUserId,
      msg.replyTo,
      msg.attachment
    )
      .then(remoteId => {
        setRoomMessages(prev => ({
          ...prev,
          [roomId]: (prev[roomId] || []).map(item =>
            item.id === msgId ? { ...item, backendMessageId: remoteId, status: 'delivered', sendError: null } : item
          ),
        }));
        loadRoomMessages(roomId).catch(() => {});
      })
      .catch(() => {
        setRoomMessages(prev => ({
          ...prev,
          [roomId]: (prev[roomId] || []).map(item =>
            item.id === msgId ? { ...item, status: 'failed', sendError: 'Message was not sent' } : item
          ),
        }));
      });
  };

  const deleteMessage = (roomId, msgId) => {
    setRoomMessages(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || []).filter(msg => msg.id !== msgId),
    }));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendMessageId = getBackendMessageId(roomMessages, roomId, msgId);
      if (backendMessageId) {
        deleteRemoteRoomMessage(backendMessageId)
          .then(() => loadRoomMessages(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  const toggleSave = (roomId) => {
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, isSaved: !(r.isSaved ?? false) } : r
    ));
  };

  const checkIn = (roomId) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const wasChecked = r.checkedInToday ?? false;
      return {
        ...r,
        checkedInToday: !wasChecked,
        activeToday: wasChecked
          ? Math.max(0, (r.activeToday ?? 1) - 1)
          : (r.activeToday ?? 0) + 1,
      };
    }));
  };

  const pulseRoom = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.hasPulsed) return;

    const goal = room.pulseGoal ?? getPulseGoal(room.maxMembers ?? room.membersCount);
    const nextCount = Math.min(goal, (room.pulseCount ?? 0) + 1);
    const willRevive = nextCount >= goal;
    const extensionDays = 7;
    const nextDaysLeft = willRevive
      ? Math.max(room.daysLeft ?? 0, 0) + extensionDays
      : room.daysLeft;
    const nextStreak = willRevive ? (room.aliveStreak ?? 0) + 1 : (room.aliveStreak ?? 0);

    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        daysLeft: nextDaysLeft,
        pulseGoal: goal,
        pulseCount: willRevive ? 0 : nextCount,
        hasPulsed: !willRevive,
        aliveStreak: nextStreak,
        lastMsg: willRevive ? `Room revived · +${extensionDays} days` : r.lastMsg,
        time: 'Just now',
      };
    }));

    if (willRevive) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setRoomMessages(prev => ({
        ...prev,
        [roomId]: [
          ...(prev[roomId] || []),
          {
            id: `pulse-${Date.now()}`,
            type: 'system',
            text: `Room revived by the team · +${extensionDays} days`,
            time: now,
            dateLabel: 'Today',
          },
        ],
      }));
      addNotification({
        eventType: 'room_revived',
        title: 'Room revived',
        desc: `Your team kept this room alive for +${extensionDays} days.`,
        roomId,
        type: 'pulse',
        typeBg: '#6B5CE7',
      });
    } else {
      addNotification({
        eventType: 'pulse_needed',
        title: 'Pulse added',
        desc: `${nextCount}/${goal} pulses collected to keep the room alive.`,
        roomId,
        type: 'pulse',
        typeBg: '#6B5CE7',
      });
    }

    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (backendRoomId) {
        pulseRemoteRoom(backendRoomId)
          .then(() => loadRoom(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  const reactToMessage = (roomId, msgId, emoji) => {
    setRoomMessages(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || []).map(msg =>
        msg.id === msgId ? { ...msg, reaction: toggleReactionSummary(msg.reaction, emoji) } : msg
      ),
    }));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendMessageId = getBackendMessageId(roomMessages, roomId, msgId);
      if (backendMessageId) {
        reactToRemoteRoomMessage(backendMessageId, emoji, backendUserId)
          .then(() => loadRoomMessages(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  const clearUnread  = (roomId) => setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unread: 0 } : r));
  const leaveRoom = (roomId) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId || (!r.isMember && !r.isMine)) return r;
      const updatedMembers = (r.members || []).filter(
        m => m.name !== 'Me' && m.name !== profile.name && !String(m.id).startsWith('me')
      );
      return {
        ...r,
        isMember:   false,
        isMine:     false,
        wasInRoom:  true,
        leftAt:     new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        membersCount: Math.max(0, r.membersCount - 1),
        online:     Math.max(0, (r.online || 1) - 1),
        members:    updatedMembers,
      };
    }));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (backendRoomId) {
        leaveRemoteRoom(backendRoomId, backendUserId)
          .then(() => loadRoom(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  const deleteRoom = (roomId) => {
    const backendRoomId = getBackendRoomId(rooms, roomId);
    if (backendRoomId) deletedRoomIdsRef.current.add(backendRoomId);
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (backendUserId && getSupabaseStatus().configured && backendRoomId) {
      deleteRemoteRoom(backendRoomId, backendUserId).catch(() => {});
    }
  };

  const receiveMessage = (roomId, sender, color, textColor, text) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: `msg-in-${Date.now()}`,
      sender,
      color,
      textColor,
      text,
      time: now,
      mine: false,
      reaction: '',
      replyTo: null,
      dateLabel: 'Today',
    };
    setRoomMessages(prev => ({ ...prev, [roomId]: [...(prev[roomId] || []), newMsg] }));
    setRooms(prev => prev.map(r =>
      r.id === roomId
        ? { ...r, lastMsg: `${sender}: ${text}`, time: 'Just now', unread: (r.unread || 0) + 1 }
        : r
    ));
    const mentionText = text.toLowerCase();
    const isMention = mentionText.includes('@you') || mentionText.includes(`@${(profile.name || '').toLowerCase()}`);
    addNotification({
      eventType: isMention ? 'mention' : 'message_sent',
      title: isMention ? `${sender} mentioned you` : `${sender} posted in a room`,
      desc: text,
      roomId,
      actor: sender,
      type: isMention ? '@' : 'message',
      typeBg: isMention ? '#22c55e' : '#6B5CE7',
    });
  };

  const joinRoom = (roomId, role = 'Member') => {
    const safeRole = String(role || 'Member').toLowerCase() === 'creator' ? 'Member' : role;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId || r.isMember) return r;
      const newMember = {
        id: `me-${Date.now()}`,
        name: profile.name || 'Me',
        role: safeRole,
        color: '#6B5CE7',
        textColor: '#fff',
        online: true,
      };
      return {
        ...r,
        isMember: true,
        membersCount: Math.min(r.maxMembers, r.membersCount + 1),
        members: [...(r.members || []), newMember],
        lastMsg: `You joined as ${safeRole}`,
        time: 'Just now',
        joinedAt: Date.now(),
        joinedRole: safeRole,
      };
    }));
    setRoomMessages(prev => ({
      ...prev,
      [roomId]: [
        ...(prev[roomId] || []),
        {
          id: `join-${Date.now()}`,
          type: 'system',
          text: `You joined the room as ${safeRole}`,
          time: now,
          dateLabel: 'Today',
        },
      ],
    }));
    addNotification({
      eventType: 'member_joined',
      title: 'You joined a room',
      desc: `You joined as ${safeRole}.`,
      roomId,
      actor: profile.name || 'Me',
      type: 'member',
      typeBg: '#0ea5e9',
    });
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (backendRoomId) {
        joinRemoteRoom(backendRoomId, safeRole, backendUserId)
          .then(() => loadRoom(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };
  const updateProfile = (fields) => {
    setProfile(prev => ({ ...prev, ...fields }));
    // upsertProfile is triggered by the profile useEffect, no need to call it here
  };
  const updateProfileTags = (tags) => {
    setProfileTags(normalizeProfileTags(tags));
  };
  const setAppearance = (mode) => setThemeMode(mode);
  const updateNotificationPrefs = (fields) =>
    setNotificationPrefs(prev => ({ ...prev, ...fields }));
  const updatePremiumSettings = (fields) =>
    setPremiumSettings(prev => ({ ...prev, ...fields }));
  const markNotifRead = (id) => {
    setReadNotifIds(prev => prev.includes(id) ? prev : [...prev, id]);
    const notification = notifications.find(n => n.id === id);
    const backendNotificationId = notification?.backendNotificationId || id;
    if (backendUserId && getSupabaseStatus().configured && notification?.backendNotificationId) {
      markRemoteNotificationRead(backendNotificationId).catch(() => {});
    }
  };
  const markAllNotifsRead = () => {
    setReadNotifIds(notifications.map(n => n.id));
    if (backendUserId && getSupabaseStatus().configured) {
      markAllRemoteNotificationsRead(backendUserId).catch(() => {});
    }
  };
  const toggleFollowMember = (member) => {
    const key = getMemberKey(member);
    const alreadyFollowing = followedUserIds.includes(key);
    setFollowedUserIds(prev =>
      alreadyFollowing ? prev.filter(id => id !== key) : [...prev, key]
    );
    if (backendUserId && getSupabaseStatus().configured && member?.backendUserId && member.backendUserId !== backendUserId) {
      const action = alreadyFollowing ? unfollowRemoteUser : followRemoteUser;
      action(backendUserId, member.backendUserId).catch(() => {});
    }
  };

  const inviteConnectionToRoom = async (roomId, person) => {
    const targetUserId = person?.backendUserId || person?.id;
    const room = roomsRef.current.find(item => item.id === roomId || item.backendRoomId === roomId);

    if (!targetUserId || !room) {
      throw new Error('Choose a connection to invite.');
    }
    if (!backendUserId || !getSupabaseStatus().configured) {
      throw new Error('You need to be signed in to send invites.');
    }
    if (targetUserId === backendUserId) {
      throw new Error('You cannot invite yourself.');
    }

    // Wait up to 8 s for the room to finish syncing and receive a backendRoomId.
    // This handles the race condition where the user tries to invite immediately after
    // creating a room (createRemoteRoom is still in flight).
    let backendRoomId = getBackendRoomId(roomsRef.current, roomId);
    if (!backendRoomId) {
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!backendUserIdRef.current) break; // user logged out during wait
        backendRoomId = getBackendRoomId(roomsRef.current, roomId);
        if (backendRoomId) break;
      }
    }
    if (!backendRoomId) {
      throw new Error('Room is still syncing. Please wait a moment and try again.');
    }

    const dedupeKey = `invite-${backendRoomId}-${targetUserId}`;
    inviteRemoteUserToRoom(backendRoomId, targetUserId, 'Member').catch(error => {
      console.warn('invite membership grant failed', error?.message);
    });
    await createRemoteNotification({
      userId: targetUserId,
      roomId: backendRoomId,
      actorId: backendUserId,
      eventType: 'invite',
      dedupeKey,
      title: `${profile.name || 'Someone'} invited you`,
      body: `Join "${room.title}"`,
    });
    loadNotifications().catch(() => {});
    loadRoom(roomId).catch(() => {});
    return { roomId, targetUserId };
  };

  const blockMember = (member) => {
    const key = getMemberKey(member);
    setBlockedUserIds(prev => prev.includes(key) ? prev : [...prev, key]);
    setFollowedUserIds(prev => prev.filter(id => id !== key));
  };

  const unblockMember = (member) => {
    const key = typeof member === 'string' ? member : getMemberKey(member);
    setBlockedUserIds(prev => prev.filter(id => id !== key));
  };

  const kickMemberFromRoom = (roomId, member) => {
    const memberKey = getMemberKey(member);
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const updatedMembers = (r.members || []).filter(m => getMemberKey(m) !== memberKey);
      return {
        ...r,
        members: updatedMembers,
        membersCount: Math.max(0, (r.membersCount || 1) - 1),
      };
    }));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      const targetBackendId = member.backendUserId || member.id;
      if (backendRoomId && targetBackendId) {
        import('../services/roomsService').then(({ leaveRoom: remoteLeave }) => {
          remoteLeave(backendRoomId, targetBackendId).catch(() => {});
        });
      }
    }
  };

  const reportContent = ({ type, roomId, targetId, targetName, reason }) => {
    const normalizedReason = String(reason || 'other').toLowerCase();
    const priority = ['harassment', 'violence', 'sexual_content'].includes(normalizedReason)
      ? 'high'
      : ['spam', 'scam'].includes(normalizedReason)
        ? 'medium'
        : 'low';
    const report = {
      id: `report-${Date.now()}`,
      type,
      roomId,
      targetId,
      targetName,
      reason,
      priority,
      createdAt: Date.now(),
      status: 'pending',
    };
    setReports(prev => [report, ...prev].slice(0, 50));
    if (backendUserId && getSupabaseStatus().configured) {
      createRemoteReport({
        reporterId: backendUserId,
        roomId: roomId ? getBackendRoomId(rooms, roomId) : null,
        targetType: type,
        targetId,
        targetName,
        reason,
      })
        .then(result => {
          setReports(prev => prev.map(item =>
            item.id === report.id
              ? {
                  ...item,
                  backendReportId: result.id,
                  priority: result.priority || item.priority,
                  autoHidden: !!result.autoHidden,
                  status: 'submitted',
                }
              : item
          ));
        })
        .catch(() => {});
    }
    return report;
  };

  const chooseMyRoomRole = (roomId, role) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        members: (r.members || []).map(member => {
          const isMe = member.name === 'Me' || member.name === profile.name || String(member.id).startsWith('me');
          return isMe ? { ...member, role } : member;
        }),
      };
    }));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (backendRoomId) {
        chooseRemoteRoomRole(backendRoomId, role, backendUserId)
          .then(() => loadRoom(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  const addRoomRole = (roomId, roleName) => {
    const clean = roleName.trim();
    if (!clean) return;
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      const current = r.roomRoles || [];
      if (current.some(role => role.toLowerCase() === clean.toLowerCase())) return r;
      const nextRoles = [...current, clean];
      return {
        ...r,
        roomRoles: nextRoles,
        roleColors: {
          ...getDefaultRoleColors(nextRoles),
          ...(r.roleColors || {}),
        },
      };
    }));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (backendRoomId) {
        addRemoteRoomRole(backendRoomId, clean)
          .then(() => loadRoom(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  const updateRoomRoleColor = (roomId, role, color) => {
    setRooms(prev => prev.map(r => (
      r.id === roomId
        ? { ...r, roleColors: { ...getDefaultRoleColors(r.roomRoles || []), ...(r.roleColors || {}), [role]: color } }
        : r
    )));
    if (backendUserId && getSupabaseStatus().configured) {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (backendRoomId) {
        updateRemoteRoomRoleColor(backendRoomId, role, color)
          .then(() => loadRoom(roomId).catch(() => {}))
          .catch(() => {});
      }
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const loadRoomMessages = async (roomId, explicitBackendRoomId = null) => {
    if (!backendUserId || !getSupabaseStatus().configured) return [];
    try {
      const backendRoomId = explicitBackendRoomId || getBackendRoomId(rooms, roomId);
      if (!backendRoomId) return [];
      const remoteMessages = await fetchRemoteRoomMessages(backendRoomId, backendUserId);
      const previousMessages = roomMessagesRef.current[roomId] || [];
      const previousByBackendId = new Map(
        previousMessages
          .filter(message => message.backendMessageId)
          .map(message => [message.backendMessageId, message])
      );
      const mergedMessages = remoteMessages.map(message => {
        const previous = previousByBackendId.get(message.backendMessageId);
        if (!message.attachment && previous?.attachment?.uri) {
          return { ...message, attachment: previous.attachment };
        }
        return message;
      });
      setRoomMessages(prev => ({
        ...prev,
        [roomId]: mergedMessages,
      }));
      const lastMessage = mergedMessages[mergedMessages.length - 1];
      if (lastMessage) {
        const senderLabel = lastMessage.mine ? 'Me' : (lastMessage.sender || 'Member');
        const bodyLabel = lastMessage.attachment
          ? (lastMessage.attachment.label || 'Attachment')
          : (lastMessage.text || '...');
        setRooms(prev => prev.map(r => {
          if (r.id !== roomId && r.backendRoomId !== backendRoomId) return r;
          return { ...r, lastMsg: `${senderLabel}: ${bodyLabel}`, time: lastMessage.time };
        }));
      }
      return mergedMessages;
    } catch (error) {
      console.warn('loadRoomMessages failed', {
        roomId,
        backendRoomId: explicitBackendRoomId || getBackendRoomId(rooms, roomId),
        message: error?.message,
      });
      return [];
    }
  };

  const subscribeRoomMessages = (roomId) => {
    if (!backendUserId || !getSupabaseStatus().configured) {
      return { unsubscribe: () => {} };
    }
    // Returns a live Set of backendMessageIds for this room so Realtime can
    // ignore reaction events that don't belong to this room's messages.
    const getMessageIds = () => {
      const msgs = roomMessagesRef.current[roomId] || [];
      return new Set(msgs.map(m => m.backendMessageId).filter(Boolean));
    };
    try {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (!backendRoomId) return { unsubscribe: () => {} };
      return subscribeToRemoteRoomMessages(
        backendRoomId,
        () => loadRoomMessages(roomId),
        backendUserId,
        getMessageIds
      );
    } catch {
      return { unsubscribe: () => {} };
    }
  };

  const loadRoom = async (roomId) => {
    if (!backendUserId || !getSupabaseStatus().configured) return null;
    try {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (!backendRoomId) return null;
      const remoteRoom = await fetchRemoteRoom(backendRoomId, backendUserId);
      if (!remoteRoom) return null;
      const existingRoom = rooms.find(room => room.id === roomId || room.backendRoomId === backendRoomId);
      const localRoomId = existingRoom?.id || remoteRoom.id;
      const normalizedRoom = {
        ...remoteRoom,
        id: localRoomId,
        backendRoomId: remoteRoom.backendRoomId || backendRoomId,
      };
      setRooms(prev => {
        const existing = prev.find(room => room.id === localRoomId || room.backendRoomId === backendRoomId);
        const nextRoom = withPulseDefaults(mergeRoomLocalState(normalizedRoom, existing));
        if (existing) {
          return prev.map(room => room.id === existing.id ? nextRoom : room);
        }
        return [nextRoom, ...prev];
      });
      return normalizedRoom;
    } catch {
      return null;
    }
  };

  const ensureRoomAvailable = async (roomId) => {
    if (!roomId) return null;
    const existing = rooms.find(room => room.id === roomId || room.backendRoomId === roomId);
    if (existing) return existing.id;
    if (!backendUserId || !getSupabaseStatus().configured || !isUuid(roomId)) return null;
    const loaded = await loadRoom(roomId);
    return loaded?.id || null;
  };

  const subscribeRoomUpdates = (roomId) => {
    if (!backendUserId || !getSupabaseStatus().configured) {
      return { unsubscribe: () => {} };
    }
    try {
      const backendRoomId = getBackendRoomId(rooms, roomId);
      if (!backendRoomId) return { unsubscribe: () => {} };
      return subscribeToRemoteRoomUpdates(
        backendRoomId,
        () => loadRoom(roomId)
      );
    } catch {
      return { unsubscribe: () => {} };
    }
  };

  const refetchRooms = async () => {
    if (!backendUserId || !getSupabaseStatus().configured) return;
    try {
      const remoteRooms = await fetchRemoteRooms({
        profileInterests: profileTags,
        userId: backendUserId,
        limit: 50,
      });
      setRooms(prev => remoteRooms.map(remoteRoom =>
        withPulseDefaults(mergeRoomLocalState(remoteRoom, prev.find(room =>
          room.id === remoteRoom.id || room.backendRoomId === remoteRoom.backendRoomId
        )))
      ));
    } catch {}
  };

  const myRooms      = useMemo(() => rooms.filter(r =>
    (r.isMember || r.isMine) && !r.wasInRoom && (r.daysLeft ?? r.lifetime ?? 14) > 0
  ), [rooms]);
  const savedRooms   = useMemo(() => rooms.filter(r => r.isSaved), [rooms]);
  const archivedRooms = useMemo(() =>
    rooms.filter(r => r.wasInRoom || ((r.isMember || r.isMine) && (r.daysLeft ?? r.lifetime ?? 14) <= 0)),
    [rooms]
  );
  const totalMessagesSent = useMemo(() =>
    Object.values(roomMessages).reduce((sum, msgs) =>
      sum + msgs.filter(m => m.mine && m.type !== 'system').length, 0),
    [roomMessages]
  );
  const connectionsCount = followedUserIds.length;
  const connections = useMemo(() => {
    const seen = new Set();
    const roomConnections = rooms.flatMap(room =>
      (room.members || []).map(member => ({ ...member, roomTitle: room.title, roomId: room.id }))
    );
    return [...followedUsers, ...roomConnections].filter(member => {
      const key = getMemberKey(member);
      if (!followedUserIds.includes(key) || seen.has(key)) return false;
      seen.add(key);
      return key !== backendUserId;
    });
  }, [followedUsers, rooms, followedUserIds, backendUserId]);

  const totalUnread = useMemo(
    () => myRooms.reduce((sum, r) => sum + (r.unread || 0), 0),
    [myRooms]
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter(n => n.section === 'new' && !readNotifIds.includes(n.id)).length,
    [notifications, readNotifIds]
  );

  const value = {
    storageReady,
    backendUserId,
    authMode: backendUserId ? 'supabase' : 'local',
    isLoggedIn,
    hasOnboarded,
    hasNickname,
    rooms,
    myRooms,
    totalUnread,
    roomMessages,
    archivedRooms,
    notifications,
    readNotifIds,
    followedUserIds,
    blockedUserIds,
    connections,
    notificationPrefs,
    premiumSettings,
    unreadNotifCount,
    profile,
    profileTags,
    totalMessagesSent,
    connectionsCount,
    themeMode,
    login,
    logout,
    deleteAccount,
    finishOnboarding,
    finishNickname,
    createRoom,
    refetchRooms,
    ensureRoomAvailable,
    sendMessage,
    loadRoomMessages,
    subscribeRoomMessages,
    loadRoom,
    subscribeRoomUpdates,
    updateMessageStatus,
    retryMessage,
    receiveMessage,
    reactToMessage,
    deleteMessage,
    toggleSave,
    checkIn,
    pulseRoom,
    clearUnread,
    savedRooms,
    joinRoom,
    leaveRoom,
    deleteRoom,
    updateProfile,
    updateProfileTags,
    updateNotificationPrefs,
    updatePremiumSettings,
    setAppearance,
    markNotifRead,
    markAllNotifsRead,
    toggleFollowMember,
    blockMember,
    unblockMember,
    kickMemberFromRoom,
    reportContent,
    chooseMyRoomRole,
    addRoomRole,
    updateRoomRoleColor,
    inviteConnectionToRoom,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
