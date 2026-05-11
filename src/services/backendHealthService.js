import { getCurrentSession } from './authService';
import { getSupabaseStatus, supabase } from './supabaseClient';

const REQUIRED_TABLES = [
  'profiles',
  'profile_interests',
  'rooms',
  'room_members',
  'messages',
  'message_reactions',
  'follows',
  'notifications',
  'notification_preferences',
  'reports',
  'account_deletion_requests',
];

async function checkTable(table) {
  try {
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    return { name: table, ok: !error, error: error?.message || null };
  } catch (error) {
    return { name: table, ok: false, error: error.message || 'Unknown error' };
  }
}

export async function checkBackendHealth() {
  const status = getSupabaseStatus();

  if (!status.configured || !supabase) {
    return {
      configured: false,
      url: null,
      signedIn: false,
      userId: null,
      tables: REQUIRED_TABLES.map(name => ({ name, ok: false, error: 'Supabase is not configured' })),
    };
  }

  let session = null;
  try {
    session = await getCurrentSession();
  } catch {}

  const tables = await Promise.all(REQUIRED_TABLES.map(checkTable));

  return {
    configured: true,
    url: status.url,
    signedIn: Boolean(session?.user?.id),
    userId: session?.user?.id || null,
    tables,
  };
}
