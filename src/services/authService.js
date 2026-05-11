import { assertSupabaseConfigured, supabase } from './supabaseClient';
import { upsertProfile } from './profileService';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export async function signUpWithEmail({ name, email, password }) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  if (data.user) {
    await upsertProfile(data.user.id, { name, bio: '', location: '', avatarUri: null }).catch(() => {});
  }
  return data;
}

export async function signInWithEmail({ email, password }) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithOAuth(provider) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'rumo://auth-callback',
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start social login.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, 'rumo://auth-callback');

  if (result.type !== 'success' || !result.url) return null;

  // Parse params from query string or hash fragment
  const raw = result.url.includes('#') ? result.url.split('#')[1] : result.url.split('?')[1] || '';
  const params = {};
  raw.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });

  if (params.code) {
    const { data: sd, error: se } = await supabase.auth.exchangeCodeForSession(params.code);
    if (se) throw se;
    return sd.session;
  }
  if (params.access_token && params.refresh_token) {
    const { data: sd, error: se } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (se) throw se;
    return sd.session;
  }
  return null;
}

export async function resetPasswordForEmail(email) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'rumo://reset-password',
  });
  if (error) throw error;
  return data;
}

export async function exchangeRecoveryCode(code) {
  assertSupabaseConfigured();
  if (!code) return null;
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.session;
}

export const exchangeAuthCode = exchangeRecoveryCode;

export async function setRecoverySession({ accessToken, refreshToken }) {
  assertSupabaseConfigured();
  if (!accessToken || !refreshToken) return null;
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data.session;
}

export const setAuthSession = setRecoverySession;

export async function updatePassword(password) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
