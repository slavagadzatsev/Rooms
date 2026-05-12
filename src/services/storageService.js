import { assertSupabaseConfigured, supabase } from './supabaseClient';
import * as FileSystem from 'expo-file-system/legacy';

const BUCKETS = {
  avatars: 'avatars',
  roomImages: 'room-images',
  messageAttachments: 'message-attachments',
};

function isRemoteUrl(uri) {
  return typeof uri === 'string' && /^https?:\/\//i.test(uri);
}

function getExtension(uri = '', fallback = 'jpg') {
  const clean = uri.split('?')[0];
  const ext = clean.includes('.') ? clean.split('.').pop().toLowerCase() : '';
  return ext && ext.length <= 5 ? ext : fallback;
}

function getMimeType(ext) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function base64ToArrayBuffer(base64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const clean = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];

  for (let i = 0; i < clean.length; i += 4) {
    const encoded1 = chars.indexOf(clean.charAt(i));
    const encoded2 = chars.indexOf(clean.charAt(i + 1));
    const encoded3 = chars.indexOf(clean.charAt(i + 2));
    const encoded4 = chars.indexOf(clean.charAt(i + 3));

    const chr1 = (encoded1 << 2) | (encoded2 >> 4);
    const chr2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const chr3 = ((encoded3 & 3) << 6) | encoded4;

    bytes.push(chr1);
    if (encoded3 !== 64 && encoded3 !== -1) bytes.push(chr2);
    if (encoded4 !== 64 && encoded4 !== -1) bytes.push(chr3);
  }

  return new Uint8Array(bytes).buffer;
}

async function readLocalUriAsBase64(uri) {
  return FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
}

export async function localImageUriToDataUrl(uri) {
  if (!uri || isRemoteUrl(uri) || String(uri).startsWith('data:')) return uri || null;
  const ext = getExtension(uri);
  const contentType = getMimeType(ext);
  const base64 = await readLocalUriAsBase64(uri);
  return `data:${contentType};base64,${base64}`;
}

async function uploadLocalUri(bucket, path, uri, contentType, { upsert = false } = {}) {
  assertSupabaseConfigured();
  if (!uri) return null;
  if (isRemoteUrl(uri)) return uri;

  const base64 = await readLocalUriAsBase64(uri);
  const fileBody = base64ToArrayBuffer(base64);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBody, {
      contentType,
      upsert,
    });
  if (error) {
    // MVP fallback: keep chat photos working even if Storage buckets/policies are not ready yet.
    return `data:${contentType};base64,${base64}`;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(userId, uri) {
  if (!uri || isRemoteUrl(uri)) return uri || null;
  const ext = getExtension(uri);
  return uploadLocalUri(BUCKETS.avatars, `${userId}/avatar.${ext}`, uri, getMimeType(ext), { upsert: true });
}

export async function uploadRoomImage(userId, uri) {
  if (!uri || isRemoteUrl(uri)) return uri || null;
  const ext = getExtension(uri);
  return uploadLocalUri(BUCKETS.roomImages, `${userId}/${Date.now()}.${ext}`, uri, getMimeType(ext));
}

export async function uploadMessageAttachment({ roomId, messageId, userId, uri, kind = 'image' }) {
  if (!uri || isRemoteUrl(uri)) return uri || null;
  const ext = getExtension(uri);
  const path = `${roomId}/${messageId || Date.now()}-${userId}.${ext}`;
  return uploadLocalUri(BUCKETS.messageAttachments, path, uri, getMimeType(ext));
}
