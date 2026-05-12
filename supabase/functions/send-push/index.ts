/**
 * send-push — Supabase Edge Function
 *
 * Triggered by Database Webhooks on:
 *   - public.messages INSERT         → notify room members; mention gets priority title
 *   - public.room_members INSERT      → notify room creator
 *   - public.message_reactions INSERT → notify message author
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/push/v2/send';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown>;
  schema: string;
}

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  channelId?: string;
}

interface NotifPref {
  user_id: string;
  enabled: boolean;
  messages: boolean;
  mentions: boolean;
  room_activity: boolean;
  room_expiry: boolean;
}

// ── Admin client ──────────────────────────────────────────────────────────────
function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getTokensForUsers(
  supabase: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<{ token: string; user_id: string }[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from('push_tokens')
    .select('token, user_id')
    .in('user_id', userIds)
    .eq('enabled', true);
  return (data ?? []) as { token: string; user_id: string }[];
}

async function getProfileName(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single();
  return (data as { name?: string } | null)?.name ?? 'Someone';
}

async function sendPushMessages(messages: PushMessage[]) {
  if (messages.length === 0) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(messages),
  });
}

type InAppNotificationRow = {
  user_id: string;
  room_id?: string | null;
  actor_id?: string | null;
  event_type: string;
  dedupe_key?: string | null;
  title: string;
  body?: string;
};

async function createInAppNotifications(
  supabase: ReturnType<typeof createClient>,
  rows: InAppNotificationRow[]
) {
  for (const row of rows) {
    const { error } = await supabase.from('notifications').insert({
      user_id: row.user_id,
      room_id: row.room_id ?? null,
      actor_id: row.actor_id ?? null,
      event_type: row.event_type,
      dedupe_key: row.dedupe_key ?? null,
      title: row.title,
      body: row.body ?? '',
    });
    // 23505 = unique_violation (duplicate dedupe_key) — expected, ignore it
    if (error && error.code !== '23505') {
      console.error('notification insert error:', row.event_type, error.message);
    }
  }
}

function extractMentionedNames(text: string): string[] {
  const matches = text.match(/@([\w\s]+?)(?=\s|$|[^a-zA-Z\s])/g) ?? [];
  return matches.map(m => m.slice(1).trim()).filter(Boolean);
}

// ── Handler: new message ──────────────────────────────────────────────────────
async function handleNewMessage(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
) {
  const roomId   = record.room_id   as string;
  const senderId = record.sender_id as string;
  const text     = (record.text as string) ?? '';

  // All active members except sender
  const { data: members } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .neq('user_id', senderId);

  const memberIds = ((members ?? []) as { user_id: string }[]).map(m => m.user_id);
  if (memberIds.length === 0) return;

  // Notification prefs for all members
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, enabled, messages, mentions')
    .in('user_id', memberIds);

  const prefMap = new Map(
    ((prefs ?? []) as NotifPref[]).map(p => [p.user_id, p])
  );

  // Detect mentioned users (by profile name, case-insensitive)
  const mentionedNames  = extractMentionedNames(text).map(n => n.toLowerCase());
  const mentionedIds    = new Set<string>();

  if (mentionedNames.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', memberIds);

    for (const profile of ((profiles ?? []) as { id: string; name: string }[])) {
      if (mentionedNames.includes((profile.name ?? '').toLowerCase())) {
        mentionedIds.add(profile.id);
      }
    }
  }

  // Split into mention-eligible and message-eligible
  const mentionEligible: string[] = [];
  const messageEligible: string[] = [];

  for (const userId of memberIds) {
    const p = prefMap.get(userId);
    if (mentionedIds.has(userId)) {
      if (!p || (p.enabled && p.mentions)) mentionEligible.push(userId);
    } else {
      if (!p || (p.enabled && p.messages)) messageEligible.push(userId);
    }
  }

  const allEligible = [...new Set([...mentionEligible, ...messageEligible])];
  const tokens      = await getTokensForUsers(supabase, allEligible);

  // Group tokens by user
  const tokenMap = new Map<string, string[]>();
  for (const { token, user_id } of tokens) {
    const list = tokenMap.get(user_id) ?? [];
    list.push(token);
    tokenMap.set(user_id, list);
  }

  const senderName = await getProfileName(supabase, senderId);
  const preview    = text.length > 120 ? `${text.slice(0, 117)}…` : text;
  const pushMessages: PushMessage[] = [];
  const inAppRows: InAppNotificationRow[] = [];

  for (const userId of mentionEligible) {
    inAppRows.push({
      user_id: userId,
      room_id: roomId,
      actor_id: senderId,
      event_type: 'mention',
      dedupe_key: `mention-${roomId}-${senderId}-${userId}-${String(record.id || Date.now())}`,
      title: `${senderName} mentioned you`,
      body: preview || 'Sent a message',
    });
    for (const token of (tokenMap.get(userId) ?? [])) {
      pushMessages.push({
        to: token,
        title: `${senderName} mentioned you`,
        body: preview || 'Sent a message',
        sound: 'default',
        channelId: 'default',
        data: { roomId, isMention: true },
      });
    }
  }

  for (const userId of messageEligible) {
    inAppRows.push({
      user_id: userId,
      room_id: roomId,
      actor_id: senderId,
      event_type: 'message_sent',
      dedupe_key: `message-${roomId}-${senderId}-${userId}-${String(record.id || Date.now())}`,
      title: senderName,
      body: preview || 'Sent a message',
    });
    for (const token of (tokenMap.get(userId) ?? [])) {
      pushMessages.push({
        to: token,
        title: senderName,
        body: preview || 'Sent a message',
        sound: 'default',
        channelId: 'default',
        data: { roomId },
      });
    }
  }

  await createInAppNotifications(supabase, inAppRows);
  await sendPushMessages(pushMessages);
}

// ── Handler: new room member ──────────────────────────────────────────────────
async function handleNewMember(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
) {
  const roomId = record.room_id as string;
  const userId = record.user_id as string;
  const role   = (record.role as string) ?? 'Member';

  const { data: room } = await supabase
    .from('rooms')
    .select('title, created_by')
    .eq('id', roomId)
    .single();

  if (!room) return;
  const { title, created_by } = room as { title: string; created_by: string };
  if (created_by === userId) return; // creator joining own room

  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('enabled, room_activity')
    .eq('user_id', created_by)
    .maybeSingle();

  const p = pref as { enabled: boolean; room_activity: boolean } | null;
  if (p && (!p.enabled || !p.room_activity)) return;

  const tokens = await getTokensForUsers(supabase, [created_by]);

  const joinerName = await getProfileName(supabase, userId);
  await createInAppNotifications(supabase, [{
    user_id: created_by,
    room_id: roomId,
    actor_id: userId,
    event_type: 'member_joined',
    dedupe_key: `member_joined-${roomId}-${userId}`,
    title,
    body: `${joinerName} joined as ${role}`,
  }]);
  if (tokens.length === 0) return;

  await sendPushMessages(
    tokens.map(({ token }) => ({
      to: token,
      title,
      body: `${joinerName} joined as ${role}`,
      sound: 'default',
      channelId: 'default',
      data: { roomId },
    }))
  );
}

// ── Handler: new reaction ─────────────────────────────────────────────────────
async function handleNewReaction(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
) {
  const messageId = record.message_id as string;
  const reactorId = record.user_id    as string;
  const emoji     = (record.reaction as string) ?? '❤️';

  const { data: message } = await supabase
    .from('messages')
    .select('sender_id, room_id, text')
    .eq('id', messageId)
    .single();

  if (!message) return;
  const { sender_id, room_id, text } = message as { sender_id: string; room_id: string; text: string };

  if (sender_id === reactorId) return; // reacting to own message

  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('enabled, room_activity')
    .eq('user_id', sender_id)
    .maybeSingle();

  const p = pref as { enabled: boolean; room_activity: boolean } | null;
  if (p && (!p.enabled || !p.room_activity)) return;

  const tokens = await getTokensForUsers(supabase, [sender_id]);

  const reactorName = await getProfileName(supabase, reactorId);
  const textPreview = text?.slice(0, 60) || 'your message';
  await createInAppNotifications(supabase, [{
    user_id: sender_id,
    room_id,
    actor_id: reactorId,
    event_type: 'reaction',
    dedupe_key: `reaction-${messageId}-${reactorId}-${sender_id}-${emoji}`,
    title: reactorName,
    body: `${emoji}  ${textPreview}`,
  }]);
  if (tokens.length === 0) return;

  await sendPushMessages(
    tokens.map(({ token }) => ({
      to: token,
      title: reactorName,
      body: `${emoji}  ${textPreview}`,
      sound: 'default',
      channelId: 'default',
      data: { roomId: room_id },
    }))
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let payload: WebhookPayload;
  try {
    payload = await req.json() as WebhookPayload;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (payload.type !== 'INSERT') return new Response('OK', { status: 200 });

  const supabase = getAdminClient();
  try {
    if      (payload.table === 'messages')          await handleNewMessage(supabase, payload.record);
    else if (payload.table === 'room_members')      await handleNewMember(supabase, payload.record);
    else if (payload.table === 'message_reactions') await handleNewReaction(supabase, payload.record);
  } catch (err) {
    console.error('send-push error:', err);
  }

  return new Response('OK', { status: 200 });
});
