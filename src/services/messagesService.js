import { assertSupabaseConfigured, supabase } from './supabaseClient';
import { localImageUriToDataUrl } from './storageService';

const EMBEDDED_IMAGE_PREFIX = 'rumo:image:';

function formatMessageTime(value) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function reactionSummary(reactions = []) {
  if (!reactions.length) return '';
  const counts = reactions.reduce((acc, item) => {
    acc[item.reaction] = (acc[item.reaction] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reaction, count]) => `${reaction} ${count}`)
    .join(' ');
}

function encodeImageMessage(attachment = {}, uri = '') {
  return `${EMBEDDED_IMAGE_PREFIX}${JSON.stringify({
    type: attachment.type || 'image',
    uri,
    label: attachment.label || 'Photo',
    width: attachment.width || null,
    height: attachment.height || null,
  })}`;
}

function parseEmbeddedImage(text = '') {
  if (typeof text !== 'string' || !text.startsWith(EMBEDDED_IMAGE_PREFIX)) return null;
  try {
    const attachment = JSON.parse(text.slice(EMBEDDED_IMAGE_PREFIX.length));
    if (!attachment?.uri) return null;
    return {
      type: attachment.type || 'image',
      uri: attachment.uri,
      label: attachment.label || 'Photo',
      width: attachment.width || null,
      height: attachment.height || null,
    };
  } catch {
    return null;
  }
}

function getVisibleMessageText(row) {
  if (row.deleted_at || row.hidden) return 'Message hidden';
  return parseEmbeddedImage(row.text) ? '' : row.text;
}

function getReplyPreviewText(row) {
  if (!row) return '';
  if (row.deleted_at || row.hidden) return 'Message hidden';
  return parseEmbeddedImage(row.text)?.label || row.text;
}

async function assertUserCanMessage(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('banned')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data?.banned) throw new Error('This account is restricted.');
}

async function getActiveUserId(fallbackUserId = null) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || fallbackUserId;
}

function mapMessage(row, currentUserId, messageById = new Map()) {
  const mine = row.sender_id === currentUserId;
  const firstAttachment = row.message_attachments?.[0];
  const embeddedAttachment = parseEmbeddedImage(row.text);
  const replyRow = row.reply_to ? messageById.get(row.reply_to) : null;
  const replyMine = replyRow?.sender_id === currentUserId;
  return {
    id: row.id,
    backendMessageId: row.id,
    senderId: row.sender_id,
    sender: mine ? 'Me' : row.profiles?.name || 'Member',
    avatarUri: row.profiles?.avatar_url || null,
    color: mine ? '#6B5CE7' : '#c9b6f8',
    textColor: mine ? '#fff' : '#3C3489',
    text: getVisibleMessageText(row),
    time: formatMessageTime(row.created_at),
    mine,
    reaction: reactionSummary(row.message_reactions || []),
    status: mine ? 'sent' : undefined,
    replyTo: replyRow ? {
      sender: replyMine ? 'Me' : replyRow.profiles?.name || 'Member',
      text: getReplyPreviewText(replyRow),
    } : null,
    attachment: firstAttachment ? {
      type: firstAttachment.kind,
      uri: firstAttachment.url,
      label: firstAttachment.label || 'Attachment',
      width: firstAttachment.width || null,
      height: firstAttachment.height || null,
    } : embeddedAttachment,
    dateLabel: getDateLabel(row.created_at),
    deleted: Boolean(row.deleted_at || row.hidden),
  };
}

function mapSimpleMessage(row, currentUserId, profilesById = new Map(), attachmentsByMessageId = new Map(), reactionsByMessageId = new Map(), messageById = new Map()) {
  const profile = profilesById.get(row.sender_id);
  const firstAttachment = attachmentsByMessageId.get(row.id)?.[0];
  const embeddedAttachment = parseEmbeddedImage(row.text);
  const replyRow = row.reply_to ? messageById.get(row.reply_to) : null;
  const replyProfile = replyRow ? profilesById.get(replyRow.sender_id) : null;
  const mine = row.sender_id === currentUserId;
  const replyMine = replyRow?.sender_id === currentUserId;

  return {
    id: row.id,
    backendMessageId: row.id,
    senderId: row.sender_id,
    sender: mine ? 'Me' : profile?.name || 'Member',
    avatarUri: profile?.avatar_url || null,
    color: mine ? '#6B5CE7' : '#c9b6f8',
    textColor: mine ? '#fff' : '#3C3489',
    text: getVisibleMessageText(row),
    time: formatMessageTime(row.created_at),
    mine,
    reaction: reactionSummary(reactionsByMessageId.get(row.id) || []),
    status: mine ? 'sent' : undefined,
    replyTo: replyRow ? {
      sender: replyMine ? 'Me' : replyProfile?.name || 'Member',
      text: getReplyPreviewText(replyRow),
    } : null,
    attachment: firstAttachment ? {
      type: firstAttachment.kind,
      uri: firstAttachment.url,
      label: firstAttachment.label || 'Attachment',
      width: firstAttachment.width || null,
      height: firstAttachment.height || null,
    } : embeddedAttachment,
    dateLabel: getDateLabel(row.created_at),
    deleted: Boolean(row.deleted_at || row.hidden),
  };
}

async function fetchRoomMessagesSimple(roomId, userId = null) {
  const { data: rows, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .eq('hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const messages = rows || [];
  if (messages.length === 0) return [];

  const senderIds = [...new Set(messages.map(row => row.sender_id).filter(Boolean))];
  const messageIds = messages.map(row => row.id);

  const [
    { data: profiles, error: profilesError },
    { data: attachments, error: attachmentsError },
    { data: reactions, error: reactionsError },
  ] = await Promise.all([
    senderIds.length
      ? supabase.from('profiles').select('id, name, avatar_url, banned').in('id', senderIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('message_attachments').select('message_id, kind, url, label, storage_path, width, height').in('message_id', messageIds),
    supabase.from('message_reactions').select('message_id, reaction, user_id').in('message_id', messageIds),
  ]);
  if (profilesError) throw profilesError;
  if (attachmentsError) throw attachmentsError;
  if (reactionsError) throw reactionsError;

  const profilesById = new Map((profiles || []).filter(profile => profile.banned !== true).map(profile => [profile.id, profile]));
  const attachmentsByMessageId = new Map();
  (attachments || []).forEach(item => {
    const list = attachmentsByMessageId.get(item.message_id) || [];
    list.push(item);
    attachmentsByMessageId.set(item.message_id, list);
  });
  const reactionsByMessageId = new Map();
  (reactions || []).forEach(item => {
    const list = reactionsByMessageId.get(item.message_id) || [];
    list.push(item);
    reactionsByMessageId.set(item.message_id, list);
  });
  const messageById = new Map(messages.map(row => [row.id, row]));

  return messages
    .filter(row => profilesById.has(row.sender_id))
    .map(row => mapSimpleMessage(row, userId, profilesById, attachmentsByMessageId, reactionsByMessageId, messageById));
}

export async function fetchRoomMessages(roomId, userId = null) {
  assertSupabaseConfigured();
  const query = supabase
    .from('messages')
    .select(`
      *,
      profiles(name, avatar_url, banned),
      message_reactions(reaction, user_id),
      message_attachments(kind, url, label, storage_path, width, height)
    `)
    .eq('room_id', roomId)
    .eq('hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) {
    return fetchRoomMessagesSimple(roomId, userId);
  }
  const visibleRows = (data || []).filter(row => row.profiles?.banned !== true);
  const messageById = new Map(visibleRows.map(row => [row.id, row]));
  return visibleRows.map(row => mapMessage(row, userId, messageById));
}

export async function sendRoomMessage(roomId, text, userId, replyTo = null, attachment = null) {
  assertSupabaseConfigured();
  if (!roomId) throw new Error('This room is still syncing. Try again in a moment.');
  const activeUserId = await getActiveUserId(userId);
  if (!activeUserId) throw new Error('A user id is required to send a message.');
  await assertUserCanMessage(activeUserId);
  let messageText = String(text || '').trim();
  if (attachment?.uri) {
    const dataUrl = attachment.dataUrl || await localImageUriToDataUrl(attachment.uri);
    if (!dataUrl) throw new Error('Photo was not uploaded');
    messageText = encodeImageMessage(attachment, dataUrl);
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: activeUserId,
      text: messageText,
      reply_to: replyTo?.backendMessageId || null,
    })
    .select()
    .single();
  if (error) throw error;
  if (attachment?.uri && messageText.startsWith(EMBEDDED_IMAGE_PREFIX)) {
    const embeddedAttachment = parseEmbeddedImage(messageText);
    supabase
      .from('message_attachments')
      .insert({
        message_id: data.id,
        room_id: roomId,
        uploaded_by: activeUserId,
        kind: 'image',
        url: embeddedAttachment?.uri || null,
        storage_path: null,
        label: attachment.label || 'Photo',
        width: attachment.width || null,
        height: attachment.height || null,
      })
      .then(({ error: attachmentError }) => {
        if (attachmentError) {
          console.warn('message attachment mirror failed', attachmentError.message);
        }
      });
  }
  return data.id;
}

export async function deleteRoomMessage(messageId) {
  assertSupabaseConfigured();
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
  return { messageId };
}

export async function reactToRoomMessage(messageId, reaction, userId) {
  assertSupabaseConfigured();
  if (!userId) throw new Error('A user id is required to react to a message.');
  await assertUserCanMessage(userId);

  const { data: existing, error: existingError } = await supabase
    .from('message_reactions')
    .select('message_id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('reaction', reaction)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('reaction', reaction);
    if (error) throw error;
    return { messageId, reaction, removed: true };
  }

  const { error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, reaction });
  if (error) throw error;
  return { messageId, reaction, removed: false };
}

export function subscribeToRoomMessages(roomId, onMessage, userId = null, getMessageIds = null) {
  assertSupabaseConfigured();
  if (!roomId) {
    return { roomId, unsubscribe: () => {} };
  }
  const channel = supabase
    .channel(`room-messages-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
      payload => {
        if (typeof onMessage === 'function') {
          onMessage(payload.new ? mapMessage(payload.new, userId) : null);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      payload => {
        if (typeof onMessage !== 'function') return;
        // Only trigger refetch if the reaction belongs to a message in this room
        if (typeof getMessageIds === 'function') {
          const changedId = payload.new?.message_id ?? payload.old?.message_id;
          if (changedId && !getMessageIds().has(changedId)) return;
        }
        onMessage(null);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_attachments', filter: `room_id=eq.${roomId}` },
      () => {
        if (typeof onMessage === 'function') onMessage(null);
      }
    )
    .subscribe();

  return {
    roomId,
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
