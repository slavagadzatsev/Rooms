import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import TagChip from './TagChip';
import { useApp } from '../context/AppContext';
import { haptics } from '../hooks/useHaptics';
import { colors, getPalette, radius } from '../theme';
import { ROOM_TYPES, roomIconBackgrounds, roomIconColors, resolveRoomIcon } from '../data/mockRooms';
import { getRoomHealth, getRoomHealthColors } from '../utils/roomHealth';
import { t } from '../i18n';

const ROOM_TYPE_ICONS = {
  project: 'radio-button-on-outline',
  networking: 'chatbubbles-outline',
  learning: 'book-outline',
};

function getLanguageFlag(language = '') {
  const normalized = language.toLowerCase();
  if (normalized.includes('russian')) return '🇷🇺';
  if (normalized.includes('spanish')) return '🇪🇸';
  if (normalized.includes('german')) return '🇩🇪';
  if (normalized.includes('french')) return '🇫🇷';
  if (normalized.includes('chinese')) return '🇨🇳';
  return '🇬🇧';
}

function getCompactHealthLabel(health) {
  if (health.key === 'active') return t('roomCard.active');
  if (health.key === 'needs_pulse') return t('roomCard.pulse');
  return health.label;
}

/** Resolves icon name and derives display color/bg for a room */
export function getRoomIconProps(room) {
  const resolved = resolveRoomIcon(room.icon);
  const defaultSoftBg = roomIconBackgrounds[resolved];
  const customAccent = room.iconBg && room.iconBg !== defaultSoftBg ? room.iconBg : null;
  const color    = customAccent || roomIconColors[resolved] || colors.purple;
  // Filled variant for white-on-color style; fall back to outline if no filled exists
  const filled   = resolved.replace('-outline', '');
  return { resolved, filled, color };
}

function RoomVisual({ room, size = 'large' }) {
  const imageStyle = size === 'large' ? styles.cardImage : styles.listImage;
  const iconSize   = size === 'large' ? 28 : 24;
  const { filled } = getRoomIconProps(room);
  if (room.imageUri) return <Image source={{ uri: room.imageUri }} style={imageStyle} />;
  return <Ionicons name={filled} size={iconSize} color="rgba(255,255,255,0.95)" />;
}

export default function RoomCard({ room, onPress, onLongPress, mode = 'feed' }) {
  const { themeMode, toggleSave } = useApp();
  const palette    = getPalette(themeMode);
  const isDark     = palette.isDark;
  const members    = `${room.membersCount}/${room.maxMembers}`;
  const { color: iconBgColor } = getRoomIconProps(room);
  const typeInfo = room.type ? ROOM_TYPES[room.type] : null;
  const isSaved  = room.isSaved ?? false;
  const daysLeft = room.daysLeft ?? room.lifetime;
  const pulseGoal = room.pulseGoal || 1;
  const pulseCount = room.pulseCount || 0;
  const needsPulse = typeof daysLeft === 'number' && daysLeft <= 3;
  const isArchived = room.wasInRoom || (typeof daysLeft === 'number' && daysLeft <= 0);
  const health = getRoomHealth(room);
  const healthColors = getRoomHealthColors(health, palette, colors);
  const allTags    = room.tags || [];
  const visibleTags = allTags.slice(0, 2);
  const extraCount  = allTags.length - visibleTags.length;
  const handlePress      = () => { haptics.light(); onPress?.(); };
  const handleLongPress  = () => { haptics.heavy(); onLongPress?.(); };
  const handleJoin       = (e) => { e.stopPropagation?.(); haptics.medium(); onPress?.(); };
  const handleBookmark   = (e) => { e.stopPropagation?.(); haptics.light(); toggleSave(room.id); };

  const cardBg = room.cardBg || null;
  const cardStyle = {
    backgroundColor: cardBg ? cardBg + '28' : palette.glass.bg,
    borderColor:     cardBg ? cardBg + 'AA' : palette.glass.border,
    shadowColor:  cardBg || (isDark ? '#000' : colors.purple),
    shadowOpacity: isDark ? 0.45 : 0.10,
    shadowRadius:  isDark ? 18 : 12,
    shadowOffset:  { width: 0, height: 4 },
    elevation: 6,
  };

  if (mode === 'list') {
    return (
      <TouchableOpacity
        style={[styles.listCard, cardStyle]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.75}
      >
        <View style={styles.listIconWrap}>
          <View style={[styles.listIcon, { backgroundColor: iconBgColor }]}>
            <RoomVisual room={room} size="small" />
          </View>
          {room.online > 0 && <View style={[styles.activeDot, { borderColor: isDark ? '#0d0b1a' : '#f0eeff' }]} />}
        </View>
        <View style={styles.listBody}>
          <View style={styles.topRow}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{room.title}</Text>
            <Text style={[styles.time, { color: palette.faint }]}>{room.time}</Text>
          </View>
          <View style={styles.listBottomRow}>
            <Text style={[styles.desc, { color: palette.muted, marginBottom: 0, flex: 1 }]} numberOfLines={1}>{room.lastMsg || room.desc}</Text>
            <View style={[styles.healthBadgeList, { backgroundColor: healthColors.bg, borderColor: healthColors.border }]}>
              <Ionicons name={health.iconName} size={10} color={healthColors.fg} />
              <Text style={[styles.healthTextList, { color: healthColors.fg }]}>{getCompactHealthLabel(health)}</Text>
            </View>
          </View>
        </View>
        {room.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{room.unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.card, cardStyle]} onPress={handlePress} onLongPress={handleLongPress} delayLongPress={400} activeOpacity={0.75}>

      {/* â”€â”€ Header: type badge + time + bookmark â”€â”€â”€ */}
      <View style={styles.cardHeader}>
        {typeInfo ? (
          <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '1E' }]}>
            <Ionicons name={ROOM_TYPE_ICONS[room.type] || 'albums-outline'} size={12} color={typeInfo.color} />
            <Text style={[styles.typeBadgeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
          </View>
        ) : <View />}
        <View style={styles.cardHeaderRight}>
          <Text style={[styles.time, { color: palette.faint }]}>{room.time}</Text>
          <TouchableOpacity onPress={handleBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isSaved ? (isDark ? '#c4b8ff' : colors.purple) : palette.faint}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* â”€â”€ Body: icon + content â”€â”€â”€ */}
      <View style={styles.cardInner}>
        <View style={styles.visualColumn}>
          <View style={[styles.cardIcon, { backgroundColor: iconBgColor }]}>
            <RoomVisual room={room} />
          </View>
          <View style={[
            styles.stateBadge,
            { backgroundColor: healthColors.bg, borderColor: healthColors.border },
          ]}>
            <Ionicons name={health.iconName} size={10} color={healthColors.fg} />
            <Text style={[styles.stateText, { color: healthColors.fg }]} numberOfLines={1}>
              {getCompactHealthLabel(health)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{room.title}</Text>
          <Text style={[styles.desc, { color: palette.muted }]} numberOfLines={2}>{room.desc}</Text>

          <View style={styles.metaRow}>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={12} color={palette.muted} />
              <Text style={[styles.detailText, { color: palette.muted }]}>{members}</Text>
            </View>
            {!!room.online && (
              <>
                <View style={[styles.metaDivider, { backgroundColor: palette.glass.borderStrong }]} />
                <View style={styles.detailItem}>
                  <View style={[styles.onlineDot, { backgroundColor: colors.green }]} />
                  <Text style={[styles.detailText, { color: palette.muted }]}>{room.online} {t('roomCard.online')}</Text>
                </View>
              </>
            )}
            {!!room.language && (
              <>
                <View style={[styles.metaDivider, { backgroundColor: palette.glass.borderStrong }]} />
                <View style={styles.detailItem}>
                  <Text style={styles.languageFlag}>{getLanguageFlag(room.language)}</Text>
                  <Text style={[styles.detailText, { color: palette.muted }]}>{room.language}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.tagsRow}>
              {visibleTags.map(tag => (
                <TagChip key={tag} label={tag} compact />
              ))}
              {extraCount > 0 && (
                <View style={[styles.extraTagChip, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <Text style={[styles.extraTagText, { color: palette.muted }]}>+{extraCount}</Text>
                </View>
              )}
            </View>
            {isArchived ? (
              <View style={[styles.memberBadge, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                <Ionicons name="archive-outline" size={12} color={palette.muted} />
                <Text style={[styles.memberBadgeText, { color: palette.muted }]}>{t('roomCard.archived')}</Text>
              </View>
            ) : room.isMember ? (
              <View style={[styles.memberBadge, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                <Ionicons name="checkmark-circle" size={12} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.memberBadgeText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('roomCard.member')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: isDark ? 'rgba(107,92,231,0.86)' : 'rgba(107,92,231,0.97)',
                    borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(107,92,231,0.38)',
                  },
                ]}
                onPress={handleJoin}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.82}
              >
                <BlurView intensity={isDark ? 34 : 16} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <Text style={styles.joinBtnText}>{t('roomCard.join')}</Text>
                <Ionicons name="arrow-forward" size={13} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {room.unread > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{room.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  typeBadgeLabel: { fontSize: 11, fontWeight: '700' },
  cardInner: {
    flexDirection: 'row',
    gap: 12,
  },
  visualColumn: {
    width: 70,
    flexShrink: 0,
    alignItems: 'center',
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%', borderRadius: 18 },
  stateBadge: {
    maxWidth: 72,
    marginTop: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  stateText: { fontSize: 9, fontWeight: '900', maxWidth: 48 },
  languageFlag: { fontSize: 11 },
  cardBody: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  title: { fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  time: { fontSize: 10 },
  desc: { fontSize: 11, lineHeight: 16, marginBottom: 7 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 10, fontWeight: '700' },
  metaDivider: { width: 1, height: 12, opacity: 0.75 },
  tagsRow: { flexDirection: 'row', gap: 5, flexWrap: 'nowrap', flex: 1, paddingRight: 8, overflow: 'hidden', alignItems: 'center' },
  extraTagChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  extraTagText: { fontSize: 10, fontWeight: '700' },
  onlineDot: { width: 5, height: 5, borderRadius: 3 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  listBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  healthBadgeList: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, flexShrink: 0 },
  healthTextList: { fontSize: 9, fontWeight: '700' },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(107,92,231,0.86)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 8,
    minHeight: 34,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  joinBtnText: { fontSize: 12, fontWeight: '900', color: colors.white },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  memberBadgeText: { fontSize: 11, fontWeight: '600' },
  unreadBadge: {
    position: 'absolute',
    top: 12, right: 12,
    minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { fontSize: 10, color: colors.white, fontWeight: '700' },
  // List mode
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.xl,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  listIconWrap: {
    width: 56, height: 56,
    flexShrink: 0,
    position: 'relative',
  },
  listIcon: {
    width: 56, height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listImage: { width: '100%', height: '100%', borderRadius: 16 },
  activeDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2.5,
    position: 'absolute', bottom: -2, right: -2,
  },
  listBody: { flex: 1 },
});
