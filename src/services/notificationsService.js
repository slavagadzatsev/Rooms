import { assertSupabaseConfigured, supabase } from './supabaseClient';

function getInitials(name = 'Rumo') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'RM';
}

function formatTime(value) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTypeBg(eventType) {
  if (eventType === 'mention') return '#22c55e';
  if (eventType === 'invite') return '#f59e0b';
  if (eventType === 'member_joined') return '#0ea5e9';
  if (eventType === 'room_expiring') return '#f59e0b';
  if (eventType === 'reaction') return '#ef4444';
  if (eventType === 'role_changed') return '#7C5CFC';
  if (eventType === 'room_revived' || eventType === 'pulse_needed') return '#6B5CE7';
  return '#6B5CE7';
}

function getType(eventType) {
  if (eventType === 'mention') return '@';
  if (eventType === 'invite') return 'invite';
  if (eventType === 'member_joined') return 'member';
  if (eventType === 'room_expiring') return 'expiry';
  if (eventType === 'reaction') return 'reaction';
  if (eventType === 'role_changed') return 'role';
  if (eventType === 'room_revived' || eventType === 'pulse_needed') return 'pulse';
  return 'message';
}

function mapNotification(row) {
  const actorName = row.actor?.name || row.rooms?.title || 'Rumo';
  return {
    id: row.id,
    backendNotificationId: row.id,
    eventType: row.event_type,
    dedupeKey: row.dedupe_key,
    avatar: getInitials(actorName),
    avatarColor: '#c9b6f8',
    avatarText: '#3C3489',
    type: getType(row.event_type),
    typeBg: getTypeBg(row.event_type),
    title: row.title,
    room: row.rooms?.title,
    roomColor: '#6B5CE7',
    roomId: row.room_id,
    desc: row.body || '',
    time: formatTime(row.created_at),
    createdAt: row.created_at,
    section: row.read_at ? 'old' : 'new',
    readAt: row.read_at,
  };
}

function mapPreferences(row) {
  if (!row) return null;
  return {
    enabled: row.enabled,
    messages: row.messages,
    mentions: row.mentions,
    invites: row.invites,
    roomActivity: row.room_activity,
    roomExpiry: row.room_expiry,
  };
}

function toPreferencesRow(userId, prefs) {
  return {
    user_id: userId,
    enabled: prefs.enabled,
    messages: prefs.messages,
    mentions: prefs.mentions,
    invites: prefs.invites,
    room_activity: prefs.roomActivity,
    room_expiry: prefs.roomExpiry,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchNotifications(userId, limit = 60) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to fetch notifications.');
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      rooms(title),
      actor:profiles!notifications_actor_id_fkey(name, avatar_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapNotification);
}

export async function fetchNotificationPreferences(userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to fetch notification preferences.');
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return mapPreferences(data);
}

export async function upsertNotificationPreferences(userId, prefs) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to save notification preferences.');
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(toPreferencesRow(userId, prefs), { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return mapPreferences(data);
}

export async function createNotification({ userId, roomId = null, actorId = null, eventType, title, body = '', dedupeKey = null }) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to create a notification.');
  const payload = {
      user_id: userId,
      room_id: roomId,
      actor_id: actorId,
      event_type: eventType,
      dedupe_key: dedupeKey,
      title,
      body,
    };
  const { error } = await supabase.from('notifications').insert(payload);
  if (error?.code === '23505' && dedupeKey) return null;
  if (error) throw error;
  return null;
}

export async function markNotificationRead(notificationId) {
  assertSupabaseConfigured();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw error;
  return { notificationId };
}

export async function markAllNotificationsRead(userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to mark notifications read.');
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export function subscribeToNotifications(userId, onChange) {
  assertSupabaseConfigured();
  if (!userId) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => {
        if (typeof onChange === 'function') onChange();
      }
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

export async function registerPushToken(userId, pushToken, platform = 'unknown', deviceId = null) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to register a push token.');
  if (!pushToken) throw new Error('A push token is required.');
  const { data, error } = await supabase
    .from('push_tokens')
    .upsert({
      user_id: userId,
      token: pushToken,
      platform,
      device_id: deviceId,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
