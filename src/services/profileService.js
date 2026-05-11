import { assertSupabaseConfigured, supabase } from './supabaseClient';
import { uploadAvatar } from './storageService';

function toStableInterestId(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '');
}

function normalizeInterests(interests = []) {
  const byName = new Map();

  interests.forEach(item => {
    if (!item?.name) return;
    const nameKey = item.name.trim().toLowerCase();
    const existing = byName.get(nameKey);

    byName.set(nameKey, {
      ...existing,
      ...item,
      id: toStableInterestId(item.name),
      name: existing?.name || item.name,
      color: existing?.color || item.color || '#6B5CE7',
      desc: item.desc || item.description || existing?.desc || '',
      focusTags: [...new Set([...(existing?.focusTags || []), ...(item.focusTags || item.focus_tags || [])].filter(Boolean))],
      keywords: [...new Set([...(existing?.keywords || []), ...(item.keywords || [])].filter(Boolean))],
    });
  });

  return Array.from(byName.values());
}

export async function fetchProfile(userId) {
  assertSupabaseConfigured();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const { data: interests, error: interestsError } = await supabase
    .from('profile_interests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (interestsError) throw interestsError;

  return {
    profile: profile ? {
      name: profile.name,
      bio: profile.bio || '',
      location: profile.location || '',
      avatarUri: profile.avatar_url || null,
      banned: Boolean(profile.banned),
    } : null,
    interests: normalizeInterests((interests || []).map(item => ({
      id: item.id,
      name: item.name,
      color: item.color || '#6B5CE7',
      desc: item.description || '',
      focusTags: item.focus_tags || [],
      keywords: item.keywords || [],
    }))),
  };
}

export async function upsertProfile(userId, profile) {
  assertSupabaseConfigured();
  const avatarUrl = await uploadAvatar(userId, profile.avatarUri);
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: profile.name || 'New user',
      bio: profile.bio || '',
      location: profile.location || '',
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return { ...profile, avatarUri: avatarUrl };
}

export async function replaceProfileInterests(userId, interests) {
  assertSupabaseConfigured();
  const { error: deleteError } = await supabase
    .from('profile_interests')
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  const rows = normalizeInterests(interests).map(item => ({
    user_id: userId,
    name: item.name,
    description: item.desc || '',
    color: item.color || '#6B5CE7',
    focus_tags: item.focusTags || [],
    keywords: item.keywords || [],
  }));
  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('profile_interests')
      .insert(rows);
    if (insertError) throw insertError;
  }
  return { userId, interests };
}

export async function fetchFollowedUsers(userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to fetch follows.');
  const { data, error } = await supabase
    .from('follows')
    .select(`
      following_id,
      profiles!follows_following_id_fkey(id, name, bio, avatar_url)
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(item => ({
    id: item.following_id,
    name: item.profiles?.name || 'Member',
    bio: item.profiles?.bio || '',
    avatarUri: item.profiles?.avatar_url || null,
  }));
}

export async function followUser(currentUserId, targetUserId) {
  assertSupabaseConfigured();
  if (!currentUserId || !targetUserId) throw new Error('Both user ids are required to follow.');
  const { error } = await supabase
    .from('follows')
    .upsert({
      follower_id: currentUserId,
      following_id: targetUserId,
    });
  if (error) throw error;
  return { targetUserId };
}

export async function unfollowUser(currentUserId, targetUserId) {
  assertSupabaseConfigured();
  if (!currentUserId || !targetUserId) throw new Error('Both user ids are required to unfollow.');
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', currentUserId)
    .eq('following_id', targetUserId);
  if (error) throw error;
  return { targetUserId };
}
