import { assertSupabaseConfigured, supabase } from './supabaseClient';

export async function deleteAccount() {
  assertSupabaseConfigured();

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new Error('Not authenticated');

  const { error } = await supabase.functions.invoke('delete-account', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
}
