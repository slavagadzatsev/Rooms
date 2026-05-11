import { assertSupabaseConfigured, supabase } from './supabaseClient';

const HIGH_PRIORITY_REASONS = new Set(['harassment', 'violence', 'sexual_content']);
const MEDIUM_PRIORITY_REASONS = new Set(['spam', 'scam']);
const AUTO_HIDE_THRESHOLD = 3;

function getPriority(reason) {
  const normalized = String(reason || 'other').toLowerCase();
  if (HIGH_PRIORITY_REASONS.has(normalized)) return 'high';
  if (MEDIUM_PRIORITY_REASONS.has(normalized)) return 'medium';
  return 'low';
}

function getContentId({ targetType, roomId, targetId }) {
  if (targetType === 'room') return roomId || targetId;
  return targetId;
}

async function maybeAutoHideContent({ targetType, contentId }) {
  if (!['room', 'message'].includes(targetType) || !contentId) return false;

  const { data, error } = await supabase
    .from('reports')
    .select('reporter_id')
    .eq('target_type', targetType)
    .eq('content_id', String(contentId))
    .neq('status', 'dismissed');

  if (error) throw error;

  const uniqueReporters = new Set((data || []).map(report => report.reporter_id));
  if (uniqueReporters.size < AUTO_HIDE_THRESHOLD) return false;

  const table = targetType === 'room' ? 'rooms' : 'messages';
  const { error: hideError } = await supabase
    .from(table)
    .update({ hidden: true })
    .eq('id', contentId);

  if (hideError) throw hideError;
  return true;
}

export async function createReport({
  reporterId,
  roomId = null,
  targetType,
  targetId = null,
  targetName = '',
  reason,
  details = '',
}) {
  assertSupabaseConfigured();
  if (!reporterId) throw new Error('A reporter id is required.');
  if (!targetType) throw new Error('A report target type is required.');
  if (!reason) throw new Error('A report reason is required.');

  const priority = getPriority(reason);
  const contentId = getContentId({ targetType, roomId, targetId });

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      room_id: roomId,
      target_type: targetType,
      content_id: contentId ? String(contentId) : null,
      target_id: targetId,
      target_name: targetName,
      reason,
      priority,
      details,
    })
    .select()
    .single();

  if (error) throw error;

  const autoHidden = await maybeAutoHideContent({ targetType, contentId });
  return { id: data.id, priority, autoHidden };
}
