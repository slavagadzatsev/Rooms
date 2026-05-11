import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Modal, Pressable, RefreshControl, Animated, Image, PanResponder, useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Safe entrance animation (stops on unmount to avoid Fabric crash) ──────────
function FadeInCard({ children, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  useEffect(() => {
    animRef.current = Animated.timing(opacity, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
    });
    animRef.current.start();
    return () => animRef.current?.stop();
  }, []);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

import EmptyState from '../components/EmptyState';
import RoomCard from '../components/RoomCard';
import SkeletonCard from '../components/SkeletonCard';
import TagChip from '../components/TagChip';
import { useApp } from '../context/AppContext';
import { haptics } from '../hooks/useHaptics';
import { TAG_CATEGORIES, languages, ROOM_TYPES } from '../data/mockRooms';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../components/TagAccordion';
import { colors, getPalette, radius, spacing } from '../theme';
import { roomIconColors, resolveRoomIcon } from '../data/mockRooms';
import { getRoomHealth, getRoomHealthColors } from '../utils/roomHealth';
import { t } from '../i18n';

const PRIVACY_LABELS = { public: 'createRoom.public', invite: 'createRoom.inviteOnly', private: 'createRoom.private' };
const PRIVACY_ICONS = { public: 'earth-outline', invite: 'link-outline', private: 'lock-closed-outline' };

const TYPE_FILTER_OPTIONS = [
  { key: 'any',        labelKey: 'home.filterAllTypes', iconName: 'apps-outline' },
  { key: 'project',    labelKey: 'createRoom.project',  iconName: 'radio-button-on-outline' },
  { key: 'networking', labelKey: 'createRoom.networking', iconName: 'chatbubbles-outline' },
  { key: 'learning',   labelKey: 'createRoom.learning', iconName: 'book-outline' },
];

const SORT_OPTIONS = [
  { key: 'recent',  labelKey: 'home.filterRecent' },
  { key: 'popular', labelKey: 'home.filterPopular' },
  { key: 'active',  labelKey: 'home.filterActive' },
];
const MEMBER_OPTIONS = [
  { key: 'any',   labelKey: 'home.filterAny' },
  { key: 'small', labelKey: 'home.filterSmall' },
  { key: 'large', labelKey: 'home.filterLarge' },
];
const LIFETIME_OPTIONS = [
  { key: 'any', labelKey: 'home.filterAny' },
  { key: 7,     labelKey: 'home.filter7days' },
  { key: 14,    labelKey: 'home.filter14days' },
  { key: 30,    labelKey: 'home.filter30days' },
];
const LANGUAGE_OPTIONS = [{ key: 'any', label: 'Any' }, ...languages.map(language => ({ key: language, label: language }))];
const DEFAULT_FILTERS = { sort: 'recent', members: 'any', lifetime: 'any', language: 'any', type: 'any' };
const SECTION_PREVIEW_LIMIT = 3;

function ActiveFilterChip({ iconName, children, color, style }) {
  return (
    <View style={[styles.activeFText, color && { backgroundColor: color + '18' }, style]}>
      {iconName && <Ionicons name={iconName} size={12} color={color || colors.purple} />}
      <Text style={[styles.activeFLabel, color && { color }]}>{children}</Text>
    </View>
  );
}

function getDaysWord(days) {
  return days === 1 ? t('home.day') : t('home.days');
}

function getLanguageFlag(language = '') {
  const normalized = language.toLowerCase();
  if (normalized.includes('russian')) return '\u{1F1F7}\u{1F1FA}';
  if (normalized.includes('spanish')) return '\u{1F1EA}\u{1F1F8}';
  if (normalized.includes('german')) return '\u{1F1E9}\u{1F1EA}';
  if (normalized.includes('french')) return '\u{1F1EB}\u{1F1F7}';
  if (normalized.includes('chinese')) return '\u{1F1E8}\u{1F1F3}';
  return '\u{1F1EC}\u{1F1E7}';
}

const INTEREST_KEYWORDS = {
  development: ['development', 'developer', 'programming', 'react', 'node', 'web', 'app', 'saas', 'code', 'startup', 'game'],
  gaming: ['gaming', 'game', 'steam', 'survival', 'developer', 'artist'],
  youtube: ['youtube', 'video', 'content', 'creator', 'channel', 'editing'],
  startup: ['startup', 'business', 'product', 'fintech', 'brand', 'team'],
  music: ['music', 'musician', 'beat', 'vocal', 'guitar', 'sound'],
  design: ['design', 'designer', 'brand', 'fashion', 'art', 'ux'],
  learning: ['learning', 'course', 'study', 'education', 'language'],
};

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function getProfileKeywords(profileTags = []) {
  const keywords = new Set();
  profileTags.forEach(tag => {
    const name = normalizeText(tag.name);
    const desc = normalizeText(tag.desc);
    if (name) keywords.add(name);
    (tag.keywords || []).forEach(word => keywords.add(normalizeText(word)));
    desc.split(/[^a-z0-9]+/).filter(word => word.length > 2).forEach(word => keywords.add(word));
    Object.entries(INTEREST_KEYWORDS).forEach(([key, words]) => {
      if (name.includes(key) || desc.includes(key)) {
        words.forEach(word => keywords.add(word));
      }
    });
  });
  return [...keywords];
}

function getRoomText(room) {
  return normalizeText([
    room.title,
    room.desc,
    room.type,
    room.language,
    room.country,
    ...(room.tags || []),
    ...(room.roomRoles || []),
  ].join(' '));
}

function getFreshnessScore(time = '') {
  const value = normalizeText(time);
  if (value.includes('min')) return 10;
  if (value.includes('hr') || value.includes('hour')) return 7;
  if (value.includes('yesterday')) return 3;
  return 5;
}

function getRecentSortScore(room) {
  if (room.createdAt) return room.createdAt;
  const value = normalizeText(room.time);
  if (value.includes('just now')) return 1_000_000;
  if (value.includes('min')) return 900_000;
  if (value.includes('hr') || value.includes('hour')) return 700_000;
  if (value.includes('yesterday')) return 300_000;
  return 100_000;
}

function getRoomMatch(room, profileTags = []) {
  const roomText = getRoomText(room);
  const keywords = getProfileKeywords(profileTags);
  const matches = keywords.filter(keyword => keyword.length > 2 && roomText.includes(keyword));
  const uniqueMatches = [...new Set(matches)].slice(0, 5);
  const daysLeft = room.daysLeft ?? room.lifetime ?? 14;
  const maxMembers = Math.max(1, room.maxMembers || 1);
  const spotsLeft = Math.max(0, maxMembers - (room.membersCount || 0));
  const fillRatio = (room.membersCount || 0) / maxMembers;
  const onlineRatio = Math.min(1, (room.online || 0) / maxMembers);
  const expiredPenalty = daysLeft <= 0 ? -100 : 0;
  const privatePenalty = room.privacy === 'private' ? -35 : 0;
  const interestScore = Math.min(42, uniqueMatches.length * 12);
  const activityScore = Math.round(onlineRatio * 18);
  const availabilityScore = spotsLeft > 0 ? Math.round((1 - fillRatio) * 14) : -18;
  const lifetimeScore = daysLeft >= 7 && daysLeft <= 21 ? 10 : daysLeft > 21 ? 6 : daysLeft <= 3 ? -6 : 4;
  const freshnessScore = getFreshnessScore(room.time);
  const languageScore = room.language === 'English' ? 6 : 2;
  const typeScore = room.type === 'project' && uniqueMatches.some(match => ['development', 'startup', 'gaming', 'product', 'app', 'game'].includes(match)) ? 8 : 0;
  const base = 36;
  const raw = base + interestScore + activityScore + availabilityScore + lifetimeScore + freshnessScore + languageScore + typeScore + expiredPenalty + privatePenalty;
  return {
    score: Math.max(0, Math.min(96, raw)),
    matches: uniqueMatches,
    spotsLeft,
  };
}

function FilterModal({ visible, onClose, filters, onApply, selectedSpheres, onApplySpheres, selectedTags, onApplyTags }) {
  const { themeMode } = useApp();
  const palette  = getPalette(themeMode);
  const isDark   = palette.isDark;
  const insets   = useSafeAreaInsets();
  const [local,        setLocal]        = useState(filters);
  const [localSpheres, setLocalSpheres] = useState(selectedSpheres);
  const [localTags,    setLocalTags]    = useState(selectedTags || []);
  const sheetY = useRef(new Animated.Value(0)).current;

  const closeSheet = () => {
    Animated.timing(sheetY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      sheetY.setValue(0);
      onClose();
    });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
    onPanResponderMove: (_, gesture) => {
      sheetY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 70 || gesture.vy > 0.9) {
        closeSheet();
        return;
      }
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    },
  }), [sheetY, onClose]);

  useEffect(() => {
    setLocal(filters);
    setLocalSpheres(selectedSpheres);
    setLocalTags(selectedTags || []);
    if (visible) sheetY.setValue(0);
  }, [filters, selectedSpheres, selectedTags, visible]);

  const set = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));


  const toggleTag = (tag) =>
    setLocalTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // When sphere is deselected, remove its tags from localTags
  const toggleSphereWithTags = (key) => {
    const cat = TAG_CATEGORIES.find(c => c.key === key);
    setLocalSpheres(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (!next.includes(key) && cat) {
        setLocalTags(t => t.filter(tag => !cat.tags.includes(tag)));
      }
      return next;
    });
  };

  const handleApply = () => {
    onApply(local);
    onApplySpheres(localSpheres);
    onApplyTags?.(localTags);
    closeSheet();
  };
  const handleReset = () => {
    setLocal(DEFAULT_FILTERS);
    setLocalSpheres([]);
    setLocalTags([]);
    onApply(DEFAULT_FILTERS);
    onApplySpheres([]);
    onApplyTags?.([]);
    closeSheet();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={closeSheet} />
      <Animated.View
        style={[
          modalStyles.sheet,
          {
            backgroundColor: isDark ? 'rgba(26,22,48,0.78)' : 'rgba(242,239,255,0.76)',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(107,92,231,0.22)',
            shadowColor: isDark ? '#000' : colors.purple,
            transform: [{ translateY: sheetY }],
          },
        ]}
      >
        <BlurView
          intensity={isDark ? 55 : 80}
          tint={isDark ? 'dark' : 'extraLight'}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={modalStyles.handleHitbox}
          onPress={closeSheet}
          activeOpacity={0.75}
          {...panResponder.panHandlers}
        >
          <View style={[modalStyles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.68)' : '#d8d4e8' }]} />
        </TouchableOpacity>

        <View style={modalStyles.headerRow}>
          <View>
            <Text style={[modalStyles.title, { color: palette.text }]}>{t('home.filters')}</Text>
            <Text style={[modalStyles.subtitle, { color: palette.faint }]}>{t('home.filtersSubtitle')}</Text>
          </View>
          <TouchableOpacity style={[modalStyles.closeBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]} onPress={closeSheet}>
            <Ionicons name="close" size={18} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={modalStyles.scroll}
          contentContainerStyle={[
            modalStyles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
        >

          {/* Room type */}
          <Text style={[modalStyles.sectionLabel, { color: palette.faint, marginTop: 2 }]}>{t('home.roomType')}</Text>
          <View style={modalStyles.typeGrid}>
            {TYPE_FILTER_OPTIONS.map(option => {
              const active = local.type === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    modalStyles.typeCard,
                    { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                    active && { backgroundColor: palette.glass.purpleBg, borderColor: isDark ? '#8f7cff' : colors.purple },
                  ]}
                  onPress={() => set('type', option.key)}
                  activeOpacity={0.78}
                >
                  <View style={[
                    modalStyles.typeIcon,
                    { backgroundColor: active ? colors.purple : palette.glass.bgStrong },
                  ]}>
                    <Ionicons name={option.iconName} size={16} color={active ? colors.white : palette.muted} />
                  </View>
                  <Text
                    style={[modalStyles.typeLabel, { color: active ? (isDark ? '#c4b8ff' : colors.purple) : palette.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.86}
                  >
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sphere */}
          <Text style={[modalStyles.sectionLabel, { color: palette.faint }]}>{t('home.sphere')}</Text>
          <View style={modalStyles.sphereGrid}>
            {TAG_CATEGORIES.map(cat => {
              const active = localSpheres.includes(cat.key);
              const col    = CATEGORY_COLORS[cat.key];
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    modalStyles.sphereChip,
                    { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                    active && { backgroundColor: col + '22', borderColor: col },
                  ]}
                  onPress={() => toggleSphereWithTags(cat.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={CATEGORY_ICONS[cat.key] || 'pricetag-outline'} size={16} color={active ? col : palette.muted} />
                  <Text
                    style={[modalStyles.sphereLabel, { color: active ? col : palette.muted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.86}
                  >
                    {cat.label}
                  </Text>
                  {active && (
                    <View style={[modalStyles.sphereCheck, { backgroundColor: col }]}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tags for selected spheres */}
          {localSpheres.length > 0 && (() => {
            const availableTags = localSpheres.flatMap(key => {
              const cat = TAG_CATEGORIES.find(c => c.key === key);
              return cat ? cat.tags.map(tag => ({ tag, key, col: CATEGORY_COLORS[key] })) : [];
            });
            return (
              <>
                <View style={modalStyles.tagsLabelRow}>
                  <Text style={[modalStyles.sectionLabel, { color: palette.faint, marginBottom: 0, marginTop: 0 }]}>{t('home.tags')}</Text>
                  {localTags.length > 0 && (
                    <TouchableOpacity onPress={() => setLocalTags([])}>
                      <Text style={[modalStyles.tagsReset, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('home.clear')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[modalStyles.pillRow, { marginBottom: 17 }]}>
                  {availableTags.map(({ tag, col }) => {
                    const active = localTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          modalStyles.tagChip,
                          { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                          active && { backgroundColor: col + '22', borderColor: col },
                        ]}
                        onPress={() => toggleTag(tag)}
                        activeOpacity={0.75}
                      >
                        {active && <Ionicons name="checkmark" size={11} color={col} />}
                        <Text style={[modalStyles.tagChipText, { color: active ? col : palette.muted }]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            );
          })()}

          {/* Sort */}
          <Text style={[modalStyles.sectionLabel, { color: palette.faint }]}>{t('home.sort')}</Text>
          <View style={modalStyles.pillRow}>
            {SORT_OPTIONS.map(option => (
              <TagChip key={option.key} label={t(option.labelKey)} active={local.sort === option.key} onPress={() => set('sort', option.key)} />
            ))}
          </View>

          {/* Members */}
          <Text style={[modalStyles.sectionLabel, { color: palette.faint }]}>{t('home.members')}</Text>
          <View style={modalStyles.pillRow}>
            {MEMBER_OPTIONS.map(option => (
              <TagChip key={option.key} label={t(option.labelKey)} active={local.members === option.key} onPress={() => set('members', option.key)} />
            ))}
          </View>

          {/* Lifetime */}
          <Text style={[modalStyles.sectionLabel, { color: palette.faint }]}>{t('home.lifetime')}</Text>
          <View style={modalStyles.pillRow}>
            {LIFETIME_OPTIONS.map(option => (
              <TagChip key={option.key} label={t(option.labelKey)} active={local.lifetime === option.key} onPress={() => set('lifetime', option.key)} />
            ))}
          </View>

          {/* Language */}
          <Text style={[modalStyles.sectionLabel, { color: palette.faint }]}>{t('home.language')}</Text>
          <View style={modalStyles.pillRow}>
            {LANGUAGE_OPTIONS.map(option => (
              <TagChip key={option.key} label={option.label} active={local.language === option.key} onPress={() => set('language', option.key)} />
            ))}
          </View>

          <View style={{ height: 18 }} />
        </ScrollView>
        <View style={[modalStyles.btnRow, { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,39,0.10)' }]}>
          <BlurView
            intensity={isDark ? 35 : 65}
            tint={isDark ? 'dark' : 'extraLight'}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity style={[modalStyles.resetBtn, { borderColor: palette.glass.border, backgroundColor: palette.glass.bgMedium }]} onPress={handleReset}>
            <Text style={[modalStyles.resetText, { color: palette.muted }]}>{t('home.reset')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.applyBtn} onPress={handleApply}>
            <Text style={modalStyles.applyText}>{t('home.apply')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function HomeScreen({ navigation }) {
  const { rooms, joinRoom, themeMode, profileTags, refetchRooms } = useApp();
  const isDark = themeMode === 'dark';
  const palette = getPalette(themeMode);
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [selectedSpheres, setSelectedSpheres] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [previewRoom, setPreviewRoom] = useState(null);
  const [previewRole, setPreviewRole] = useState('Member');
  const [expandedSections, setExpandedSections] = useState({
    recommended: false,
    popular: false,
    recent: false,
  });

  useEffect(() => {
    const roles = (previewRoom?.roomRoles || [])
      .filter(role => String(role).toLowerCase() !== 'creator');
    if (roles.length === 0) roles.push('Member');
    setPreviewRole(roles.includes('Member') ? 'Member' : roles[0]);
  }, [previewRoom?.id]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchRooms();
    } finally {
      setRefreshing(false);
    }
  }, [refetchRooms]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.type !== 'any') count += 1;
    if (filters.sort !== 'recent') count += 1;
    if (filters.members !== 'any') count += 1;
    if (filters.lifetime !== 'any') count += 1;
    if (filters.language !== 'any') count += 1;
    count += selectedSpheres.length;
    count += selectedTags.length;
    return count;
  }, [filters, selectedSpheres, selectedTags]);

  const toggleSphere = (key) => {
    setSelectedSpheres(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      // When sphere is deselected from the pill bar, remove its tags too
      if (!next.includes(key)) {
        const cat = TAG_CATEGORIES.find(c => c.key === key);
        if (cat) setSelectedTags(t => t.filter(tag => !cat.tags.includes(tag)));
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = [...rooms];
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      list = list.filter(room =>
        room.title.toLowerCase().includes(query) ||
        room.desc.toLowerCase().includes(query) ||
        room.language?.toLowerCase().includes(query) ||
        room.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedSpheres.length > 0) {
      list = list.filter(room =>
        selectedSpheres.some(sphereKey => {
          const cat = TAG_CATEGORIES.find(c => c.key === sphereKey);
          return cat?.tags.some(tag => room.tags.includes(tag));
        })
      );
    }

    if (selectedTags.length > 0) {
      list = list.filter(room => selectedTags.some(tag => room.tags.includes(tag)));
    }

    if (filters.type !== 'any') list = list.filter(room => room.type === filters.type);
    if (filters.members === 'small') list = list.filter(room => room.maxMembers <= 8);
    if (filters.members === 'large') list = list.filter(room => room.maxMembers >= 9);
    if (filters.lifetime !== 'any') list = list.filter(room => room.lifetime === filters.lifetime);
    if (filters.language !== 'any') list = list.filter(room => room.language === filters.language);
    return list;
  }, [rooms, searchQuery, selectedSpheres, selectedTags, filters]);

  const activeRooms = filtered.filter(room => !room.wasInRoom && (room.daysLeft ?? room.lifetime ?? 14) > 0);
  // Recommendation stays focused on rooms you can discover, but Home can still show your new rooms elsewhere.
  const discoverable = activeRooms.filter(r => !r.isMember && !r.isMine);
  const scoredDiscoverable = useMemo(() => {
    const list = discoverable.map(room => ({
      ...room,
      recommendation: getRoomMatch(room, profileTags),
    }));
    if (filters.sort === 'popular') return list.sort((a, b) => (b.online || 0) - (a.online || 0));
    if (filters.sort === 'active') return list.sort((a, b) => (b.unread || 0) - (a.unread || 0));
    return list.sort((a, b) => b.recommendation.score - a.recommendation.score);
  }, [discoverable, profileTags, filters.sort]);
  const recommended  = scoredDiscoverable.slice(0, 8);
  const popular      = scoredDiscoverable
    .filter(room => !recommended.some(item => item.id === room.id))
    .sort((a, b) => (b.online || 0) - (a.online || 0))
    .slice(0, 8);
  const newlyCreated = useMemo(() => {
    const used = new Set([...recommended, ...popular].map(room => room.id));
    return activeRooms
      .filter(room => !used.has(room.id))
      .sort((a, b) => getRecentSortScore(b) - getRecentSortScore(a))
      .slice(0, 8);
  }, [activeRooms, recommended, popular]);
  const visibleRecommended = expandedSections.recommended ? recommended : recommended.slice(0, SECTION_PREVIEW_LIMIT);
  const visiblePopular = expandedSections.popular ? popular : popular.slice(0, SECTION_PREVIEW_LIMIT);
  const visibleNewlyCreated = expandedSections.recent ? newlyCreated : newlyCreated.slice(0, SECTION_PREVIEW_LIMIT);
  const isFiltering  = searchQuery.length > 0 || selectedSpheres.length > 0 || activeFilterCount > 0;

  const toggleSection = (key) => {
    haptics.light();
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSectionHeader = (title, sectionKey, total, extraStyle) => {
    const expanded = expandedSections[sectionKey];
    const canExpand = total > SECTION_PREVIEW_LIMIT;
    return (
      <View style={[styles.sectionHeader, extraStyle]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
        {canExpand ? (
          <TouchableOpacity
            style={[styles.sectionAction, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
            onPress={() => toggleSection(sectionKey)}
            activeOpacity={0.76}
          >
            <Text style={[styles.sectionActionText, { color: isDark ? '#c4b8ff' : colors.purple }]}>
              {expanded ? t('home.showLess') : t('home.showMore')}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={isDark ? '#c4b8ff' : colors.purple}
            />
          </TouchableOpacity>
        ) : (
          <Text style={[styles.sectionCount, { color: palette.faint }]}>{total} room{total === 1 ? '' : 's'}</Text>
        )}
      </View>
    );
  };

  const openRoom = (room) => {
    if (room.isMember || room.isMine) {
      navigation.navigate('Room', { roomId: room.id });
    } else {
      setPreviewRoom(room);
    }
  };

  const handleJoinAndOpen = (room) => {
    joinRoom(room.id, previewRole);
    setPreviewRoom(null);
    setTimeout(() => navigation.navigate('Room', { roomId: room.id }), 80);
  };

  const previewRoles = (previewRoom?.roomRoles || [])
    .filter(role => String(role).toLowerCase() !== 'creator');
  if (previewRoles.length === 0) previewRoles.push('Member');
  const previewSpotsLeft = previewRoom ? Math.max(0, (previewRoom.maxMembers || 0) - (previewRoom.membersCount || 0)) : 0;
  const previewIsFull = previewRoom ? previewSpotsLeft <= 0 : false;
  const previewIsExpired = previewRoom ? ((previewRoom.daysLeft ?? previewRoom.lifetime ?? 0) <= 0) : false;
  const previewCanJoin = !!previewRoom && !previewIsFull && !previewIsExpired && previewRoom.privacy !== 'private';
  const previewHealth = previewRoom ? getRoomHealth(previewRoom) : null;
  const previewHealthColors = previewHealth ? getRoomHealthColors(previewHealth, palette, colors) : null;
  const previewReasons = previewRoom ? [
    previewSpotsLeft > 0 ? {
      iconName: 'person-add-outline',
      text: `${previewSpotsLeft} open ${previewSpotsLeft === 1 ? 'spot' : 'spots'}`,
    } : null,
    previewRoom.online > 0 ? {
      iconName: 'radio-button-on-outline',
      text: `${previewRoom.online} online now`,
    } : null,
    previewRoom.language ? {
      symbol: getLanguageFlag(previewRoom.language),
      text: previewRoom.language,
    } : null,
  ].filter(Boolean).slice(0, 4) : [];

  return (
    <View style={styles.root}>
      {/* Gradient base for glassmorphism */}
      <LinearGradient
        colors={palette.bgGrad}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />
      <SafeAreaView style={styles.container}>
      <View style={[styles.page, isWide && styles.pageWide]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: palette.text }]}>{t('home.discover')}</Text>
        </View>

      {/* ── Glass Search Row ── */}
      <View style={styles.searchRow}>
        {/* Search bar glass layer */}
        <View
          style={[
            styles.searchBarWrap,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.82)',
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.16)',
            },
            searchQuery.length > 0 && { borderColor: palette.glass.purpleBorder },
          ]}
        >
          <BlurView intensity={isDark ? 30 : 55} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
          <View style={[styles.searchIconBubble, { backgroundColor: palette.glass.purpleBg }]}>
            <Ionicons name="search-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
          </View>
          <TextInput
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.58)' : 'rgba(17,24,39,0.52)'}
            style={[styles.searchInput, { color: palette.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}><Ionicons name="close" size={14} color={palette.faint} /></TouchableOpacity>
          )}
        </View>

        {/* Glass filter button */}
        <TouchableOpacity
          style={[styles.filterBtn, { borderColor: palette.glass.border }, activeFilterCount > 0 && { borderColor: palette.glass.purpleBorder }]}
          onPress={() => { haptics.light(); setShowFilter(true); }}
        >
          <BlurView intensity={isDark ? 30 : 55} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.purple : palette.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catRow}
        contentContainerStyle={styles.catContent}
      >
        <TouchableOpacity
          style={[styles.spherePill, selectedSpheres.length === 0 && styles.spherePillAllActive]}
          onPress={() => setSelectedSpheres([])}
          activeOpacity={0.75}
        >
          <Text style={[styles.spherePillText, { color: selectedSpheres.length === 0 ? colors.white : palette.muted }]}>{t('home.all')}</Text>
        </TouchableOpacity>
        {TAG_CATEGORIES.map(cat => {
          const active = selectedSpheres.includes(cat.key);
          const col = CATEGORY_COLORS[cat.key];
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.spherePill,
                { borderColor: active ? col : palette.glass.border, backgroundColor: active ? col + '22' : palette.glass.bgMedium },
                active && styles.spherePillActive,
              ]}
              onPress={() => { haptics.light(); toggleSphere(cat.key); }}
              activeOpacity={0.75}
            >
              <Ionicons name={CATEGORY_ICONS[cat.key] || 'pricetag-outline'} size={14} color={active ? col : palette.muted} />
              <Text style={[styles.spherePillText, { color: active ? col : palette.muted }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>


      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersRow}>
          <Text style={[styles.activeFiltersLabel, { color: palette.faint }]}>{t('home.filters')}:</Text>
          {selectedSpheres.map(key => {
            const cat = TAG_CATEGORIES.find(c => c.key === key);
            const col = CATEGORY_COLORS[key];
            return cat ? (
              <ActiveFilterChip key={key} iconName={CATEGORY_ICONS[key] || 'pricetag-outline'} color={col}>{cat.label}</ActiveFilterChip>
            ) : null;
          })}
          {filters.type !== 'any' && (
            <ActiveFilterChip iconName={TYPE_FILTER_OPTIONS.find(o => o.key === filters.type)?.iconName}>
              {t(TYPE_FILTER_OPTIONS.find(o => o.key === filters.type)?.labelKey)}
            </ActiveFilterChip>
          )}
          {filters.sort !== 'recent' && (
            <ActiveFilterChip iconName="swap-vertical-outline">{t(SORT_OPTIONS.find(o => o.key === filters.sort)?.labelKey)}</ActiveFilterChip>
          )}
          {filters.members !== 'any' && (
            <ActiveFilterChip iconName="people-outline">{t(MEMBER_OPTIONS.find(o => o.key === filters.members)?.labelKey)}</ActiveFilterChip>
          )}
          {filters.lifetime !== 'any' && (
            <ActiveFilterChip iconName="time-outline">{filters.lifetime} {t('home.days')}</ActiveFilterChip>
          )}
          {filters.language !== 'any' && (
            <ActiveFilterChip iconName="language-outline">{filters.language}</ActiveFilterChip>
          )}
          {selectedTags.map(tag => (
            <ActiveFilterChip key={tag} iconName="pricetag-outline">{tag}</ActiveFilterChip>
          ))}
          <TouchableOpacity onPress={() => { setFilters(DEFAULT_FILTERS); setSelectedSpheres([]); setSelectedTags([]); }}>
            <Text style={styles.clearFilters}>{t('home.reset')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.purple}
            colors={[colors.purple]}
          />
        }
      >
        {loading ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.skeletonLabel} />
              <View style={[styles.skeletonLabel, { width: 40 }]} />
            </View>
            {[1, 2, 3].map(i => <SkeletonCard key={i} mode="feed" />)}
            <View style={[styles.sectionHeader, styles.sectionHeaderSecond]}>
              <View style={styles.skeletonLabel} />
              <View style={[styles.skeletonLabel, { width: 40 }]} />
            </View>
            {[4, 5].map(i => <SkeletonCard key={i} mode="feed" />)}
          </>
        ) : isFiltering ? (
          activeRooms.length === 0 ? (
            <EmptyState
              title={t('home.noRoomsTitle')}
              subtitle={searchQuery ? `${t('home.searchNoResults')} "${searchQuery}"` : t('home.noRoomsSubtitle')}
            />
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('home.results')}</Text>
                <Text style={styles.seeAll}>{activeRooms.length} {t('home.found')}</Text>
              </View>
              {activeRooms
                .map(room => ({ ...room, recommendation: getRoomMatch(room, profileTags) }))
                .sort((a, b) => {
                  if (filters.sort === 'popular') return (b.online || 0) - (a.online || 0);
                  if (filters.sort === 'active') return (b.unread || 0) - (a.unread || 0);
                  return getRecentSortScore(b) - getRecentSortScore(a);
                })
                .map((room, i) => (
                <FadeInCard key={room.id} delay={i * 60}>
                  <RoomCard room={room} onPress={() => openRoom(room)} />
                </FadeInCard>
              ))}
            </>
          )
        ) : recommended.length === 0 && popular.length === 0 && newlyCreated.length === 0 ? (
          <View style={styles.allJoinedState}>
            {rooms.length === 0 ? (
              <>
                <Text style={styles.allJoinedEmoji}>🚀</Text>
                <Text style={[styles.allJoinedTitle, { color: palette.text }]}>{t('home.emptyFirstTitle')}</Text>
                <Text style={[styles.allJoinedSub, { color: palette.muted }]}>{t('home.emptyFirstSub')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.allJoinedEmoji}>🎉</Text>
                <Text style={[styles.allJoinedTitle, { color: palette.text }]}>{t('home.allJoinedTitle')}</Text>
                <Text style={[styles.allJoinedSub, { color: palette.muted }]}>{t('home.allJoinedSub')}</Text>
              </>
            )}
            <TouchableOpacity
              style={styles.allJoinedBtn}
              onPress={() => { haptics.medium(); navigation.navigate('CreateRoom'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.allJoinedBtnText}>{t('home.createYourOwnRoom')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {renderSectionHeader(t('home.recommended'), 'recommended', recommended.length)}
            {visibleRecommended.map((room, i) => (
              <FadeInCard key={room.id} delay={i * 60}>
                <RoomCard room={room} onPress={() => openRoom(room)} />
              </FadeInCard>
            ))}

            {popular.length > 0 && (
              <>
                {renderSectionHeader(t('home.popular'), 'popular', popular.length, styles.sectionHeaderSecond)}
                {visiblePopular.map((room, i) => (
                  <FadeInCard key={room.id} delay={visibleRecommended.length * 60 + i * 60}>
                    <RoomCard room={room} onPress={() => openRoom(room)} />
                  </FadeInCard>
                ))}
              </>
            )}

            {newlyCreated.length > 0 && (
              <>
                {renderSectionHeader(t('home.newlyCreated'), 'recent', newlyCreated.length, styles.sectionHeaderSecond)}
                {visibleNewlyCreated.map((room, i) => (
                  <FadeInCard key={room.id} delay={(visibleRecommended.length + visiblePopular.length) * 60 + i * 60}>
                    <RoomCard room={room} onPress={() => openRoom(room)} />
                  </FadeInCard>
                ))}
              </>
            )}
          </>
        )}
        <View style={styles.feedBottom} />
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: isDark ? 'rgba(107,92,231,0.72)' : 'rgba(107,92,231,0.96)',
            borderColor: isDark ? 'rgba(255,255,255,0.26)' : 'rgba(107,92,231,0.75)',
          },
        ]}
        onPress={() => { haptics.medium(); navigation.navigate('CreateRoom'); }}
        activeOpacity={0.82}
      >
        <BlurView
          intensity={isDark ? 48 : 18}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="add" size={18} color="#ffffff" />
        <Text style={styles.fabText}>{t('home.createRoom')}</Text>
      </TouchableOpacity>
      </View>
      </SafeAreaView>

      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        filters={filters}
        onApply={setFilters}
        selectedSpheres={selectedSpheres}
        onApplySpheres={setSelectedSpheres}
        selectedTags={selectedTags}
        onApplyTags={setSelectedTags}
      />

      {/* Room Preview Modal */}
      <Modal
        visible={!!previewRoom}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewRoom(null)}
      >
        <Pressable style={previewStyles.backdrop} onPress={() => setPreviewRoom(null)} />
        {previewRoom && (
          <View style={[previewStyles.sheet, { backgroundColor: isDark ? '#1a1630' : colors.white, borderColor: palette.glass.border }]}>
            <TouchableOpacity style={previewStyles.handleHitbox} onPress={() => setPreviewRoom(null)} activeOpacity={0.75}>
              <View style={[previewStyles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#ddd' }]} />
            </TouchableOpacity>

            <View style={previewStyles.header}>
              {(() => {
                const resolved = resolveRoomIcon(previewRoom.icon);
                const iColor   = roomIconColors[resolved] || colors.purple;
                return (
                  <View style={[previewStyles.icon, { backgroundColor: iColor }]}>
                    {previewRoom.imageUri
                      ? <Image source={{ uri: previewRoom.imageUri }} style={previewStyles.iconImage} />
                      : <Ionicons name={resolved.replace('-outline', '')} size={30} color="rgba(255,255,255,0.95)" />
                    }
                  </View>
                );
              })()}
              <View style={previewStyles.headerInfo}>
                {previewRoom.type && ROOM_TYPES[previewRoom.type] && (
                  <View style={previewStyles.headerBadges}>
                    <View style={[previewStyles.typeBadge, { backgroundColor: ROOM_TYPES[previewRoom.type].color + '1E' }]}>
                      <Text style={[previewStyles.typeBadgeText, { color: ROOM_TYPES[previewRoom.type].color }]}>
                        {ROOM_TYPES[previewRoom.type].icon} {ROOM_TYPES[previewRoom.type].label}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={[previewStyles.title, { color: palette.text }]} numberOfLines={2}>{previewRoom.title}</Text>
                <View style={[previewStyles.languagePill, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <Text style={previewStyles.languageFlag}>{getLanguageFlag(previewRoom.language || 'English')}</Text>
                  <Text style={[previewStyles.languageText, { color: palette.muted }]}>{previewRoom.language || 'English'}</Text>
                </View>
              </View>
            </View>

            <ScrollView style={previewStyles.body} showsVerticalScrollIndicator={false}>
              {/* Description */}
              <View style={[previewStyles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <Text style={[previewStyles.cardLabel, { color: palette.faint }]}>{t('roomPreview.goal').toUpperCase()}</Text>
                <Text style={[previewStyles.cardText, { color: palette.text }]}>{previewRoom.desc}</Text>
              </View>

              {previewReasons.length > 0 && (
                <View style={[previewStyles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                  <Text style={[previewStyles.cardLabel, { color: palette.faint }]}>{t('roomPreview.details').toUpperCase()}</Text>
                  <View style={previewStyles.reasonGrid}>
                    {previewReasons.map((reason, index) => (
                      <View key={`${reason.text}-${index}`} style={[previewStyles.reasonChip, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                        {reason.symbol ? (
                          <Text style={previewStyles.reasonSymbol}>{reason.symbol}</Text>
                        ) : (
                          <Ionicons name={reason.iconName} size={13} color={isDark ? '#c4b8ff' : colors.purple} />
                        )}
                        <Text style={[previewStyles.reasonChipText, { color: palette.text }]} numberOfLines={1}>{reason.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Role */}
              <View style={[previewStyles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <Text style={[previewStyles.cardLabel, { color: palette.faint }]}>{t('roomPreview.chooseRole').toUpperCase()}</Text>
                <View style={previewStyles.roleRow}>
                  {previewRoles.map(role => {
                    const active = previewRole === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[
                          previewStyles.roleChip,
                          { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                          active && { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder },
                        ]}
                        onPress={() => {
                          haptics.light();
                          setPreviewRole(role);
                        }}
                        activeOpacity={0.76}
                      >
                        {active && <Ionicons name="checkmark-circle" size={13} color={isDark ? '#c4b8ff' : colors.purple} />}
                        <Text style={[previewStyles.roleText, { color: active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted }]}>
                          {role}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tags */}
              <View style={[previewStyles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <Text style={[previewStyles.cardLabel, { color: palette.faint }]}>{t('roomPreview.tags').toUpperCase()}</Text>
                <View style={previewStyles.tagsRow}>
                  {previewRoom.tags.map(tag => (
                    <View key={tag} style={[previewStyles.tagChip, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                      <Text style={[previewStyles.tagText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Stats */}
              <View style={[previewStyles.statsRow, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                {[
                  { iconName: 'people-outline', val: `${previewRoom.membersCount}/${previewRoom.maxMembers}`, lbl: t('roomPreview.members') },
                  { iconName: 'radio-button-on-outline', val: previewRoom.online,  lbl: t('roomPreview.online') },
                  {
                    iconName: 'time-outline',
                    val: `${previewRoom.daysLeft ?? previewRoom.lifetime} ${getDaysWord(previewRoom.daysLeft ?? previewRoom.lifetime)}`,
                    lbl: t('roomPreview.left'),
                  },
                ].map((s, i) => (
                  <View key={i} style={[previewStyles.stat, i < 2 && { borderRightWidth: 1, borderRightColor: palette.glass.border }]}>
                    <Ionicons name={s.iconName} size={16} color={isDark ? '#c4b8ff' : colors.purple} style={previewStyles.statIcon} />
                    <Text style={[previewStyles.statVal, { color: palette.text }]}>{s.val}</Text>
                    <Text style={[previewStyles.statLbl, { color: palette.faint }]}>{s.lbl}</Text>
                  </View>
                ))}
              </View>

              {previewHealth && (
                <View style={[previewStyles.healthRow, { backgroundColor: previewHealthColors.bg, borderColor: previewHealthColors.border }]}>
                  <View style={previewStyles.healthTitleRow}>
                    <Ionicons name={previewHealth.iconName} size={16} color={previewHealthColors.fg} />
                    <Text style={[previewStyles.healthTitle, { color: previewHealthColors.fg }]}>{previewHealth.label}</Text>
                  </View>
                  <Text style={[previewStyles.healthDesc, { color: palette.muted }]}>{previewHealth.description}</Text>
                </View>
              )}

              {/* Members preview */}
              <View style={[previewStyles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <View style={previewStyles.membersHeader}>
                  <Text style={[previewStyles.cardLabel, { color: palette.faint, marginBottom: 0 }]}>{t('roomPreview.peopleInside').toUpperCase()}</Text>
                  <Text style={[previewStyles.spotsText, { color: previewSpotsLeft > 0 ? colors.green : colors.red }]}>
                    {previewSpotsLeft > 0 ? `${previewSpotsLeft} ${previewSpotsLeft === 1 ? t('roomPreview.spotLeft') : t('roomPreview.spotsLeft')}` : t('roomPreview.full')}
                  </Text>
                </View>
                <View style={previewStyles.membersPreviewRow}>
                  {(previewRoom.members || []).slice(0, 5).map(member => (
                    <View key={member.id} style={previewStyles.memberMini}>
                      <View style={[previewStyles.memberMiniAv, { backgroundColor: member.color }]}>
                        <Text style={[previewStyles.memberMiniText, { color: member.textColor }]}>{member.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <Text style={[previewStyles.memberMiniName, { color: palette.faint }]} numberOfLines={1}>{member.name}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Privacy */}
              <View style={[previewStyles.privacyRow, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <Ionicons
                  name={PRIVACY_ICONS[previewRoom.privacy] || 'earth-outline'}
                  size={16}
                  color={isDark ? '#c4b8ff' : colors.purple}
                />
                <Text style={[previewStyles.cardText, { color: palette.muted }]}>
                  {t(PRIVACY_LABELS[previewRoom.privacy] || 'createRoom.public')}
                </Text>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* CTA */}
            <View style={previewStyles.footer}>
              <TouchableOpacity
                style={[previewStyles.joinBtn, !previewCanJoin && previewStyles.joinBtnDisabled]}
                onPress={() => handleJoinAndOpen(previewRoom)}
                disabled={!previewCanJoin}
                activeOpacity={0.85}
              >
                <Text style={previewStyles.joinBtnText}>
                  {previewIsExpired ? t('roomPreview.roomExpired') : previewIsFull ? t('roomPreview.roomFull') : previewRoom.privacy === 'private' ? t('roomPreview.privateRoom') : `${t('roomPreview.joinAs')} ${previewRole} ->`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 10,
  },
  handleHitbox: { alignSelf: 'center', paddingHorizontal: 44, paddingTop: 2, paddingBottom: 12 },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: '100%', height: '100%' },
  headerInfo: { flex: 1 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 7 },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  sub: { fontSize: 12, marginTop: 4 },
  languagePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 7,
  },
  languageFlag: { fontSize: 12 },
  languageText: { fontSize: 11, fontWeight: '800' },
  body: { paddingHorizontal: 16 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  cardText: { fontSize: 13, lineHeight: 20 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  reasonSymbol: { fontSize: 13 },
  reasonChipText: { fontSize: 11.5, fontWeight: '700', maxWidth: 180 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  roleText: { fontSize: 12, fontWeight: '800' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: 12,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  statIcon: { marginBottom: 4 },
  statVal: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  statLbl: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  healthRow: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: 12,
  },
  healthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  healthTitle: { fontSize: 13, fontWeight: '900' },
  healthDesc: { fontSize: 12, lineHeight: 17 },
  membersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  spotsText: { fontSize: 11, fontWeight: '800' },
  membersPreviewRow: { flexDirection: 'row', gap: 10 },
  memberMini: { width: 46, alignItems: 'center' },
  memberMiniAv: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  memberMiniText: { fontSize: 10.5, fontWeight: '800' },
  memberMiniName: { fontSize: 9.5, fontWeight: '600', maxWidth: 46 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  joinBtn: {
    backgroundColor: colors.purple,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  joinBtnDisabled: { opacity: 0.45 },
  joinBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: {
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 8,
    overflow: 'hidden',
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handleHitbox: { alignSelf: 'center', paddingHorizontal: 44, paddingTop: 8, paddingBottom: 12 },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scroll: { flex: 1, paddingHorizontal: 22 },
  scrollContent: { flexGrow: 1 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#aaaaaa',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 9,
    marginTop: 7,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 18,
  },
  typeCard: {
    width: '48%',
    minHeight: 62,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  typeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  sphereGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 17 },
  sphereChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: '48%',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill, borderWidth: 1.5,
  },
  sphereLabel: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  sphereCheck: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tagsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    marginTop: 7,
  },
  tagsReset: { fontSize: 11, fontWeight: '700' },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  tagChipText: { fontSize: 12, fontWeight: '600' },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { fontSize: 14, fontWeight: '800', color: colors.muted },
  applyBtn: {
    flex: 2,
    backgroundColor: colors.purple,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontSize: 14, fontWeight: '900', color: colors.white },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  page: { flex: 1, width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 640 },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  screenTitle: { fontSize: 26, fontWeight: '700' },
  searchRow: { flexDirection: 'row', paddingHorizontal: spacing.screen, paddingVertical: 10, gap: 10 },

  // Glass search bar
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingLeft: 9,
    paddingRight: 10,
    paddingVertical: 7,
    gap: 8,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 46,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  searchIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107,92,231,0.26)',
  },
  searchInput: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  clearSearchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,112,160,0.14)',
  },
  clearSearch: { fontSize: 18, lineHeight: 18 },

  // Glass filter button
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, color: colors.white, fontWeight: '800' },
  catRow: { paddingVertical: 4, marginBottom: 4, maxHeight: 46 },
  catContent: { paddingHorizontal: spacing.screen, gap: 8, alignItems: 'center' },
  spherePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: 'transparent', backgroundColor: 'rgba(150,140,200,0.12)',
  },
  spherePillAllActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  spherePillActive: { borderWidth: 1.5 },
  spherePillText: { fontSize: 12.5, fontWeight: '600' },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.screen,
    marginBottom: 6,
  },
  activeFiltersLabel: { fontSize: 11, color: '#aaaaaa' },
  activeFText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.purplePale,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeFLabel: { fontSize: 11, color: colors.purple, fontWeight: '600' },
  clearFilters: { fontSize: 11, color: colors.red, fontWeight: '600' },
  feed: { flex: 1, paddingHorizontal: spacing.screen },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  sectionHeaderSecond: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionMeta: { fontSize: 12, fontWeight: '700' },
  sectionCount: { fontSize: 11.5, fontWeight: '700' },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionActionText: { fontSize: 11.5, fontWeight: '800' },
  seeAll: { fontSize: 12, color: colors.purple, fontWeight: '500' },
  feedBottom: { height: 150 },
  skeletonLabel: { height: 13, width: 120, borderRadius: 6, backgroundColor: 'rgba(150,140,200,0.18)' },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 13,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  fabText: { fontSize: 14, fontWeight: '800', color: colors.white },

  // ── All joined empty state ────────────────────────────────────────
  allJoinedState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  allJoinedEmoji: { fontSize: 52, marginBottom: 16 },
  allJoinedTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  allJoinedSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 28 },
  allJoinedBtn: {
    backgroundColor: colors.purple,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  allJoinedBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },

});

