import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, RefreshControl, Alert, ActionSheetIOS, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';

import EmptyState from '../components/EmptyState';
import RoomCard from '../components/RoomCard';
import SkeletonCard from '../components/SkeletonCard';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius, spacing } from '../theme';
import { t } from '../i18n';

const TABS = ['my', 'saved', 'archive'];
const LEGACY_TAB_MAP = { 'My rooms': 'my', Saved: 'saved', Archive: 'archive' };
const TAB_LABELS = { my: 'rooms.myRooms', saved: 'rooms.saved', archive: 'rooms.archive' };

const EMPTY_STATES = {
  saved:   { title: 'rooms.noSavedRooms', subtitle: 'rooms.noSavedRoomsSub', btnLabel: 'rooms.findRooms' },
  archive: { title: 'rooms.archiveEmpty', subtitle: 'rooms.archiveEmptySub' },
};

export default function RoomsScreen({ navigation, route }) {
  const { myRooms, savedRooms, archivedRooms, leaveRoom, themeMode, refetchRooms } = useApp();
  const palette    = getPalette(themeMode);
  const isDark     = palette.isDark;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const initialTab = LEGACY_TAB_MAP[route?.params?.initialTab] || route?.params?.initialTab || 'my';
  const [activeTab,    setActiveTab]    = useState(initialTab);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showSearch,   setShowSearch]   = useState(false);
  const [sortBy,       setSortBy]       = useState('newest');
  const [refreshing,   setRefreshing]   = useState(false);
  const [loading,      setLoading]      = useState(true);

  const SORT_LABELS = { newest: t('rooms.newestFirst'), unread: t('rooms.unreadFirst'), active: t('rooms.activeFirst') };

  const handleSort = () => {
    const options = [t('rooms.newestFirst'), t('rooms.unreadFirst'), t('rooms.activeFirst'), t('rooms.cancel')];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: t('rooms.sortRooms') },
        (i) => { if (i < 3) setSortBy(['newest', 'unread', 'active'][i]); }
      );
    } else {
      Alert.alert(t('rooms.sortRooms'), '', [
        { text: t('rooms.newestFirst'), onPress: () => setSortBy('newest') },
        { text: t('rooms.unreadFirst'), onPress: () => setSortBy('unread') },
        { text: t('rooms.activeFirst'), onPress: () => setSortBy('active') },
        { text: t('rooms.cancel'), style: 'cancel' },
      ]);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (route?.params?.initialTab) {
      const next = LEGACY_TAB_MAP[route.params.initialTab] || route.params.initialTab;
      if (TABS.includes(next)) setActiveTab(next);
    }
  }, [route?.params?.initialTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchRooms();
    } finally {
      setRefreshing(false);
    }
  }, [refetchRooms]);

  const visibleRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = query
      ? myRooms.filter(r =>
          r.title.toLowerCase().includes(query) ||
          r.desc.toLowerCase().includes(query) ||
          (r.lastMsg || '').toLowerCase().includes(query)
        )
      : [...myRooms];
    if (sortBy === 'unread') list = list.sort((a, b) => (b.unread || 0) - (a.unread || 0));
    if (sortBy === 'active') list = list.sort((a, b) => (b.online || 0) - (a.online || 0));
    return list;
  }, [myRooms, searchQuery, sortBy]);

  const visibleSavedRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return savedRooms;
    return savedRooms.filter(r =>
      r.title.toLowerCase().includes(query) ||
      r.desc.toLowerCase().includes(query) ||
      (r.lastMsg || '').toLowerCase().includes(query)
    );
  }, [savedRooms, searchQuery]);

  const visibleArchivedRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return archivedRooms;
    return archivedRooms.filter(r =>
      r.title.toLowerCase().includes(query) ||
      r.desc.toLowerCase().includes(query) ||
      (r.lastMsg || '').toLowerCase().includes(query)
    );
  }, [archivedRooms, searchQuery]);

  const openRoom = (room) => navigation.navigate('Room', { roomId: room.id });
  const goExplore = () => navigation.getParent('RootTabs')?.navigate('Home');
  const goCreateRoom = () => navigation.getParent('RootTabs')?.navigate('Home', { screen: 'CreateRoom' });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setShowSearch(false);
  };

  const handleLongPress = (room) => {
    Alert.alert(room.title, t('rooms.quickActions'), [
      { text: t('rooms.openRoom'), onPress: () => openRoom(room) },
      {
        text: t('rooms.leaveRoom'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('rooms.leaveRoomQuestion'), t('rooms.leaveRoomSub'), [
            { text: t('rooms.cancel'), style: 'cancel' },
            { text: t('rooms.leave'), style: 'destructive', onPress: () => leaveRoom(room.id) },
          ]);
        },
      },
      { text: t('rooms.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
      <SafeAreaView style={styles.container}>
      <View style={[styles.page, isWide && styles.pageWide]}>

        {/* Header */}
        <View style={styles.header}>
          {showSearch ? (
            <View style={[styles.searchBar, { borderColor: palette.glass.border }]}>
              <Ionicons name="search-outline" size={16} color={palette.faint} />
              <TextInput
                style={[styles.searchInput, { color: palette.text }]}
                placeholder={t('rooms.searchPlaceholder')}
                placeholderTextColor={palette.faint}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
                <Ionicons name="close" size={18} color={palette.faint} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: palette.text }]}>{t('rooms.title')}</Text>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}
                onPress={() => setShowSearch(true)}
              >
                <Ionicons name="search-outline" size={20} color={palette.text} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Glass Tabs */}
        <View style={styles.tabsWrap}>
          <View style={[styles.tabsBg, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
            {TABS.map(tab => {
              const active = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, active && { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.purpleBorder }]}
                  onPress={() => handleTabChange(tab)}
                >
                  <Text style={[styles.tabText, { color: active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted }]}>
                    {t(TAB_LABELS[tab])}
                    {tab === 'saved' && savedRooms.length > 0 ? ` ${savedRooms.length}` : ''}
                    {tab === 'archive' && archivedRooms.length > 0 ? ` ${archivedRooms.length}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* My rooms */}
        {activeTab === 'my' && (
          <>
            <View style={styles.sectionRow}>
              <View style={styles.sectionLeft}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('rooms.activeRooms')}</Text>
                <View style={[styles.countBadge, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                  <Text style={[styles.countText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{myRooms.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleSort}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.sortBtn}
              >
                <Text style={[styles.sortText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{SORT_LABELS[sortBy]}</Text>
                <Ionicons name="chevron-down" size={13} color={isDark ? '#c4b8ff' : colors.purple} />
              </TouchableOpacity>
            </View>

            {!loading && myRooms.length === 0 ? (
              <View style={styles.emptyTabWrap}>
                <EmptyState iconName="chatbubbles-outline" title={t('rooms.noRoomsYet')} subtitle={t('rooms.noRoomsYetSub')} />
                <TouchableOpacity style={styles.emptyBtn} onPress={goExplore}>
                  <Text style={styles.emptyBtnText}>{t('rooms.findRooms')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emptyBtnOutline, { borderColor: isDark ? 'rgba(196,184,255,0.4)' : colors.purple }]}
                  onPress={goCreateRoom}>
                  <Text style={[styles.emptyBtnOutlineText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('rooms.createRoom')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
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
                  [1,2,3,4].map(i => <SkeletonCard key={i} mode="list" />)
                ) : visibleRooms.length === 0 ? (
                  <View style={styles.emptyInFeed}>
                    <EmptyState iconName="search-outline" title={t('rooms.noRoomsFound')} subtitle={t('rooms.tryDifferentQuery')} />
                  </View>
                ) : (
                  visibleRooms.map(room => (
                    <RoomCard key={room.id} room={room} mode="list"
                      onPress={() => openRoom(room)}
                      onLongPress={() => handleLongPress(room)}
                    />
                  ))
                )}
                <View style={styles.bottomSpacer} />
              </ScrollView>
            )}
          </>
        )}

        {/* Saved tab */}
        {activeTab === 'saved' && (
          savedRooms.length === 0 ? (
            <View style={styles.emptyTabWrap}>
              <EmptyState iconName="bookmark-outline" title={t(EMPTY_STATES.saved.title)} subtitle={t(EMPTY_STATES.saved.subtitle)} />
              <TouchableOpacity style={styles.emptyBtn} onPress={goExplore}>
                <Text style={styles.emptyBtnText}>{t('rooms.findRooms')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.sectionRow}>
                <View style={styles.sectionLeft}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('rooms.saved')}</Text>
                  <View style={[styles.countBadge, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Text style={[styles.countText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{savedRooms.length}</Text>
                  </View>
                </View>
              </View>
              <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
                {visibleSavedRooms.length === 0 ? (
                  <View style={styles.emptyInFeed}>
                    <EmptyState iconName="search-outline" title={t('rooms.noSavedRoomsFound')} subtitle={t('rooms.tryDifferentQuery')} />
                  </View>
                ) : visibleSavedRooms.map(room => (
                  <RoomCard key={room.id} room={room} onPress={() => openRoom(room)} />
                ))}
                <View style={styles.bottomSpacer} />
              </ScrollView>
            </>
          )
        )}

        {/* Archive tab */}
        {activeTab === 'archive' && (
          archivedRooms.length === 0 ? (
            <View style={styles.emptyTabWrap}>
              <EmptyState iconName="archive-outline" title={t(EMPTY_STATES.archive.title)} subtitle={t(EMPTY_STATES.archive.subtitle)} />
            </View>
          ) : (
            <>
              <View style={styles.sectionRow}>
                <View style={styles.sectionLeft}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('rooms.archived')}</Text>
                  <View style={[styles.countBadge, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Text style={[styles.countText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{archivedRooms.length}</Text>
                  </View>
                </View>
                <Text style={[styles.sortText, { color: palette.faint }]}>{t('rooms.expiredLeft')}</Text>
              </View>
              <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
                {visibleArchivedRooms.length === 0 ? (
                  <View style={styles.emptyInFeed}>
                    <EmptyState iconName="search-outline" title={t('rooms.noArchivedRoomsFound')} subtitle={t('rooms.tryDifferentQuery')} />
                  </View>
                ) : (
                  visibleArchivedRooms.map(room => (
                    <RoomCard key={room.id} room={room} mode="list" onPress={() => openRoom(room)} />
                  ))
                )}
                <View style={styles.bottomSpacer} />
              </ScrollView>
            </>
          )
        )}

      </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  page: { flex: 1, width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 640 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 9,
    gap: 8, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: { flex: 1, fontSize: 13 },
  tabsWrap: { paddingHorizontal: 20, marginBottom: 14 },
  tabsBg: { borderRadius: radius.lg, padding: 4, flexDirection: 'row', borderWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '600' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  countBadge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
  countText: { fontSize: 11, fontWeight: '700' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortText: { fontSize: 12, fontWeight: '600' },
  feed: { flex: 1, paddingHorizontal: spacing.screen },
  bottomSpacer: { height: 100 },
  emptyInFeed: { paddingTop: 36 },
  emptyTabWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, paddingHorizontal: 16 },
  emptyBtn: { backgroundColor: colors.purple, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 12, marginTop: 12 },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  emptyBtnOutline: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnOutlineText: { fontSize: 13, fontWeight: '700' },
});
