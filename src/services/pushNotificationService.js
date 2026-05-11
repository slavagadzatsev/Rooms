import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase, getSupabaseStatus } from './supabaseClient';

// ─── Foreground handler ───────────────────────────────────────────────────────
// Show alert, sound and badge even when the app is open in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Android channel ──────────────────────────────────────────────────────────
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Rumo',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6B5CE7',
    sound: 'default',
    enableVibrate: true,
  });
}

// ─── Permission-only request (no Supabase required) ──────────────────────────
/**
 * Ask for notification permission at a natural moment (e.g. after onboarding).
 * Safe to call multiple times — skips the system dialog if already granted/denied.
 */
export async function requestNotificationPermission() {
  try {
    if (Platform.OS === 'android') await ensureAndroidChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    if (existing === 'denied') return false;   // already denied — don't re-prompt
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Token registration ───────────────────────────────────────────────────────
/**
 * Request permission, get an Expo Push Token, and save it to Supabase.
 * Safe to call multiple times — uses upsert.
 * Returns the token string or null if not available / not permitted.
 */
export async function registerPushToken(userId) {
  if (!userId || !getSupabaseStatus().configured) return null;

  try {
    // Push tokens only work on physical devices
    if (!Constants.isDevice) return null;

    // Request permission if not already granted
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    await ensureAndroidChannel();

    // EAS project ID is required for Expo Push to work in production
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData?.data;
    if (!token) return null;

    // Save/update token in Supabase
    await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );

    return token;
  } catch {
    return null;
  }
}

/**
 * Mark the current device's token as disabled in Supabase on logout/delete.
 */
export async function unregisterPushToken(userId) {
  if (!userId || !getSupabaseStatus().configured) return;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData?.data;
    if (!token) return;
    await supabase
      .from('push_tokens')
      .update({ enabled: false })
      .eq('user_id', userId)
      .eq('token', token);
  } catch {}
}

// ─── Listeners ────────────────────────────────────────────────────────────────
/**
 * Fires when a notification arrives while the app is in the foreground.
 * Returns a subscription with a .remove() method.
 */
export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Fires when the user taps a notification (foreground or background).
 * Returns a subscription with a .remove() method.
 */
export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Reset the app badge counter to zero.
 */
export async function clearBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}
