import { assertSupabaseConfigured, supabase } from './supabaseClient';
import { uploadRoomImage } from './storageService';
import { getPulseGoal } from '../utils/roomUtils';
import { upsertProfile } from './profileService';

const ALLOWED_ROOM_TYPES = new Set(['project', 'networking', 'learning']);
const ROLE_COLOR_PALETTE = ['#7C5CFC', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

function normalizeRoomType(type) {
  return ALLOWED_ROOM_TYPES.has(type) ? type : 'project';
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDaysLeft(expiresAt) {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function uniqueCleanList(items, fallback = []) {
  const cleaned = (items || [])
    .map(item => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned.length > 0 ? cleaned : fallback));
}

function getDefaultRoleColor(index = 0) {
  return ROLE_COLOR_PALETTE[index % ROLE_COLOR_PALETTE.length];
}


async function assertUserCanParticipate(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('banned')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data?.banned) throw new Error('This account is restricted.');
}

async function getActiveUserId(fallbackUserId = null) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || fallbackUserId;
}

function mapRoom(row, currentUserId = null) {
  const members = (row.room_members || []).filter(
    member => member.status === 'active' && member.profiles?.banned !== true
  );
  const tags = (row.room_tags || []).map(item => item.tag);
  const roleRows = row.room_roles || [];
  const roles = roleRows.map(item => item.name);
  const roleColors = Object.fromEntries(
    roleRows.map((item, index) => [item.name, item.color || getDefaultRoleColor(index)])
  );
  const creator = members.find(member => member.user_id === row.created_by);
  const currentMembership = currentUserId
    ? members.find(member => member.user_id === currentUserId)
    : null;

  return {
    id: row.id,
    backendRoomId: row.id,
    createdBy: creator?.profiles?.name || 'Creator',
    icon: row.icon || 'sparkles',
    imageUri: row.image_url || null,
    iconBg: row.icon_bg || '#ede9ff',
    cardBg: row.card_bg || null,
    title: row.title,
    desc: row.description,
    tags,
    membersCount: members.length,
    maxMembers: row.max_members,
    online: members.length,
    lifetime: row.lifetime_days,
    daysLeft: getDaysLeft(row.expires_at),
    pulseGoal: row.pulse_goal,
    pulseCount: row.pulse_count,
    hasPulsed: false,
    aliveStreak: row.alive_streak,
    time: 'Recently',
    unread: 0,
    section: 'recommended',
    isMember: Boolean(currentMembership),
    isMine: row.created_by === currentUserId,
    privacy: row.privacy,
    language: row.language,
    lastMsg: 'No messages yet',
    type: row.type,
    checkinEnabled: row.checkin_enabled,
    activeToday: 0,
    checkedInToday: false,
    members: members.map(member => ({
      id: member.user_id,
      backendUserId: member.user_id,
      name: member.profiles?.name || 'Member',
      avatarUri: member.profiles?.avatar_url || null,
      bio: member.profiles?.bio || null,
      role: member.role || 'Member',
      color: '#c9b6f8',
      textColor: '#3C3489',
      online: true,
    })),
    roomRoles: roles.length > 0 ? roles : ['Member'],
    roleColors,
  };
}

function roomsWithMetadataQuery() {
  return supabase.from('rooms').select(`
    *,
    room_tags(tag),
      room_roles(name, color),
    room_members(
      user_id,
      role,
      status,
      profiles(name, avatar_url, bio, banned)
    )
  `);
}

async function fetchRoomsWithMetadata(query, currentUserId) {
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(row => mapRoom(row, currentUserId));
}

export async function fetchRecommendedRooms({ profileInterests, filters, limit = 40, userId = null } = {}) {
  assertSupabaseConfigured();
  const query = roomsWithMetadataQuery()
    .gt('expires_at', new Date().toISOString())
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  let rooms = await fetchRoomsWithMetadata(query, userId);

  if (filters?.language && filters.language !== 'Any') {
    rooms = rooms.filter(room => room.language === filters.language);
  }
  if (filters?.type && filters.type !== 'all') {
    rooms = rooms.filter(room => room.type === filters.type);
  }

  const interestWords = uniqueCleanList(
    (profileInterests || []).flatMap(interest => [
      interest.name,
      ...(interest.focusTags || []),
      ...(interest.keywords || []),
    ])
  ).map(word => word.toLowerCase());

  if (interestWords.length === 0) return rooms;

  return rooms
    .map(room => {
      const haystack = [
        room.title,
        room.desc,
        room.type,
        room.language,
        ...(room.tags || []),
      ].join(' ').toLowerCase();
      const score = interestWords.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
      return { room, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.room);
}

export async function fetchRoom(roomId, userId = null) {
  assertSupabaseConfigured();
  const { data, error } = await roomsWithMetadataQuery()
    .eq('id', roomId)
    .eq('hidden', false)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRoom(data, userId) : null;
}

export async function createRoom(draft, userId) {
  assertSupabaseConfigured();
  const activeUserId = await getActiveUserId(userId);
  if (!activeUserId) throw new Error('A user id is required to create a room.');
  await upsertProfile(activeUserId, {
    name: draft.creatorName || 'Rumo user',
    bio: '',
    location: '',
    avatarUri: null,
  }).catch(() => {});
  await assertUserCanParticipate(activeUserId);

  const lifetime = Number(draft.lifetime || draft.lifetimeDays || 14);
  const maxMembers = Number(draft.maxMembers || 8);
  const tags = uniqueCleanList(draft.tags, ['General']);
  const roles = uniqueCleanList(draft.roles, ['Member'])
    .filter(role => role.toLowerCase() !== 'creator');
  const now = new Date();
  const imageUrl = await uploadRoomImage(activeUserId, draft.imageUri || draft.image_url || null);

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      created_by: activeUserId,
      title: String(draft.name || draft.title || '').trim(),
      description: String(draft.description || draft.desc || '').trim(),
      icon: draft.icon || 'sparkles',
      image_url: imageUrl || null,
      icon_bg: draft.iconBg || '#ede9ff',
      card_bg: draft.cardBg || null,
      type: normalizeRoomType(draft.type),
      privacy: draft.privacy || 'public',
      language: draft.language || 'English',
      max_members: maxMembers,
      lifetime_days: lifetime,
      expires_at: addDays(now, lifetime).toISOString(),
      pulse_goal: getPulseGoal(maxMembers),
      pulse_count: 0,
      alive_streak: 0,
      checkin_enabled: draft.checkinEnabled ?? true,
    })
    .select()
    .single();
  if (roomError) throw roomError;

  const inserts = [
    supabase.from('room_members').insert({
      room_id: room.id,
      user_id: activeUserId,
      role: 'Creator',
      status: 'active',
    }),
  ];

  if (tags.length > 0) {
    inserts.push(supabase.from('room_tags').insert(tags.map(tag => ({ room_id: room.id, tag }))));
  }
  if (roles.length > 0) {
    const draftRoleColors = draft.roleColors || {};
    inserts.push(supabase.from('room_roles').insert(roles.map((name, index) => ({
      room_id: room.id,
      name,
      color: draftRoleColors[name] || getDefaultRoleColor(index + 1),
    }))));
  }

  const results = await Promise.all(inserts);
  const error = results.find(result => result.error)?.error;
  if (error) throw error;

  return room.id;
}

export async function joinRoom(roomId, role, userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to join a room.');
  await assertUserCanParticipate(userId);
  const safeRole = String(role || 'Member').toLowerCase() === 'creator' ? 'Member' : role || 'Member';
  const { error } = await supabase
    .from('room_members')
    .upsert({
      room_id: roomId,
      user_id: userId,
      role: safeRole,
      status: 'active',
      left_at: null,
    });
  if (error) throw error;
  return { roomId, role: safeRole };
}

export async function inviteUserToRoom(roomId, targetUserId, role = 'Member') {
  assertSupabaseConfigured();
  if (!roomId || !targetUserId) throw new Error('A room and user are required to invite.');
  const activeUserId = await getActiveUserId();
  if (!activeUserId) throw new Error('A user id is required to invite.');
  await assertUserCanParticipate(activeUserId);
  const safeRole = String(role || 'Member').toLowerCase() === 'creator' ? 'Member' : role || 'Member';
  // Don't downgrade an already-active membership
  const { data: existing } = await supabase
    .from('room_members')
    .select('status')
    .eq('room_id', roomId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (existing?.status === 'active') return { roomId, userId: targetUserId, role: safeRole, alreadyMember: true };
  const { error } = await supabase
    .from('room_members')
    .upsert({
      room_id: roomId,
      user_id: targetUserId,
      role: safeRole,
      status: 'invited',
      left_at: null,
    });
  if (error) throw error;
  return { roomId, userId: targetUserId, role: safeRole };
}

export async function leaveRoom(roomId, userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to leave a room.');
  const { error } = await supabase
    .from('room_members')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
  return { roomId };
}

export async function removeRoomMember(roomId, targetUserId) {
  assertSupabaseConfigured();
  if (!roomId || !targetUserId) throw new Error('A room and member are required.');
  const { error } = await supabase
    .from('room_members')
    .update({ status: 'removed', left_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', targetUserId);
  if (error) throw error;
  return { roomId, userId: targetUserId };
}

export async function chooseRoomRole(roomId, role, userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to choose a room role.');
  await assertUserCanParticipate(userId);
  const safeRole = String(role || 'Member').toLowerCase() === 'creator' ? 'Member' : role || 'Member';
  const { error } = await supabase
    .from('room_members')
    .update({ role: safeRole })
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
  return { roomId, role: safeRole };
}

export async function addRoomRole(roomId, roleName, color = null) {
  assertSupabaseConfigured();
  const clean = String(roleName || '').trim();
  if (!clean || clean.toLowerCase() === 'creator') return { roomId, roleName: clean };
  const { error } = await supabase
    .from('room_roles')
    .insert({ room_id: roomId, name: clean, color: color || getDefaultRoleColor(0) });
  if (error && error.code !== '23505') throw error;
  return { roomId, roleName: clean };
}

export async function updateRoomRoleColor(roomId, roleName, color) {
  assertSupabaseConfigured();
  const clean = String(roleName || '').trim();
  if (!clean || !color) return { roomId, roleName: clean, color };
  const { error } = await supabase
    .from('room_roles')
    .update({ color })
    .eq('room_id', roomId)
    .eq('name', clean);
  if (error) throw error;
  return { roomId, roleName: clean, color };
}

export async function pulseRoom(roomId) {
  assertSupabaseConfigured();
  const { data: room, error: fetchError } = await supabase
    .from('rooms')
    .select('pulse_count, pulse_goal, alive_streak, expires_at')
    .eq('id', roomId)
    .single();
  if (fetchError) throw fetchError;

  const nextPulseCount = Math.min(room.pulse_goal, (room.pulse_count || 0) + 1);
  const willRevive = nextPulseCount >= room.pulse_goal;
  const nextExpiresAt = willRevive
    ? addDays(new Date(Math.max(Date.now(), new Date(room.expires_at).getTime())), 7).toISOString()
    : room.expires_at;

  const { error: updateError } = await supabase
    .from('rooms')
    .update({
      pulse_count: willRevive ? 0 : nextPulseCount,
      alive_streak: willRevive ? (room.alive_streak || 0) + 1 : room.alive_streak,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId);
  if (updateError) throw updateError;

  return {
    roomId,
    pulseCount: willRevive ? 0 : nextPulseCount,
    revived: willRevive,
    expiresAt: nextExpiresAt,
  };
}

export async function deleteRoom(roomId, userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to delete a room.');
  const { error } = await supabase
    .from('rooms')
    .update({ hidden: true, updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('created_by', userId);
  if (error) throw error;
  return { roomId };
}

export function subscribeToRoomUpdates(roomId, onChange) {
  assertSupabaseConfigured();
  if (!roomId) return { unsubscribe: () => {} };

  const notify = () => {
    if (typeof onChange === 'function') onChange();
  };

  const channel = supabase
    .channel(`room-updates-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
      notify
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` },
      notify
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_roles', filter: `room_id=eq.${roomId}` },
      notify
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'room_tags', filter: `room_id=eq.${roomId}` },
      notify
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
