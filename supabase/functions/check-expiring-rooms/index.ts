/**
 * check-expiring-rooms â€” Supabase Edge Function
 *
 * Runs once a day via Supabase Scheduled Function.
 * Finds rooms expiring in 1, 2 or 3 days and sends a push to all active members.
 *
 * Deploy:
 *   supabase functions deploy check-expiring-rooms
 *
 * Schedule in Dashboard â†’ Edge Functions â†’ check-expiring-rooms â†’ Schedule:
 *   Cron: 0 10 * * *   (every day at 10:00 UTC)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/push/v2/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  channelId?: string;
}

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

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

async function sendPushMessages(messages: PushMessage[]) {
  if (messages.length === 0) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(messages),
  });
}

async function createInAppNotifications(
  supabase: ReturnType<typeof createClient>,
  rows: {
    user_id: string;
    room_id: string;
    event_type: string;
    dedupe_key: string;
    title: string;
    body: string;
  }[]
) {
  if (rows.length === 0) return;
  await supabase
    .from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
}

Deno.serve(async (_req: Request) => {
  const supabase = getAdminClient();

  const now     = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 60_000); // +3d +1min buffer

  // Rooms that expire within the next 3 days and haven't expired yet
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, title, expires_at')
    .gt('expires_at', now.toISOString())
    .lt('expires_at', in3Days.toISOString())
    .eq('hidden', false);

  for (const room of ((rooms ?? []) as { id: string; title: string; expires_at: string }[])) {
    const msLeft   = new Date(room.expires_at).getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

    // Get all active members
    const { data: members } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', room.id)
      .eq('status', 'active');

    const memberIds = ((members ?? []) as { user_id: string }[]).map(m => m.user_id);
    if (memberIds.length === 0) continue;

    // Filter by notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, enabled, room_expiry')
      .in('user_id', memberIds);

    const prefMap = new Map(
      ((prefs ?? []) as { user_id: string; enabled: boolean; room_expiry: boolean }[])
        .map(p => [p.user_id, p])
    );

    const eligible = memberIds.filter(id => {
      const p = prefMap.get(id);
      return !p || (p.enabled && p.room_expiry);
    });

    const dayWord = daysLeft === 1 ? 'day' : 'days';
    const body    = daysLeft === 1
      ? `Last day! Pulse now to keep "${room.title}" alive.`
      : `"${room.title}" expires in ${daysLeft} ${dayWord}. Pulse to keep it alive!`;
    const title = 'Room expiring soon';

    await createInAppNotifications(
      supabase,
      eligible.map(userId => ({
        user_id: userId,
        room_id: room.id,
        event_type: 'room_expiring',
        dedupe_key: `room_expiring-${room.id}-${userId}-${daysLeft}`,
        title,
        body,
      }))
    );

    const tokens = await getTokensForUsers(supabase, eligible);
    if (tokens.length === 0) continue;

    const messages: PushMessage[] = tokens.map(({ token }) => ({
      to:        token,
      title,
      body,
      sound:     'default',
      channelId: 'default',
      data:      { roomId: room.id },
    }));

    await sendPushMessages(messages);
  }

  return new Response('OK', { status: 200 });
});
