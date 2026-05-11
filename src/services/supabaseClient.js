import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_ENV = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

const isConfigured = Boolean(SUPABASE_ENV.url && SUPABASE_ENV.anonKey);

export const supabase = isConfigured
  ? createClient(SUPABASE_ENV.url, SUPABASE_ENV.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function assertSupabaseConfigured() {
  if (!isConfigured) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY when backend migration starts.'
    );
  }
}

export function getSupabaseStatus() {
  return {
    configured: isConfigured,
    url: SUPABASE_ENV.url || null,
  };
}
