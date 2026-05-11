import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import EmptyState from '../components/EmptyState';
import { colors, getPalette, radius } from '../theme';
import { t } from '../i18n';

const TABS = ['All', 'Unread', 'Mentions', 'Invites'];
const TAB_LABELS = {
  All: 'notifications.all',
  Unread: 'notifications.unread',
  Mentions: 'notifications.mentions',
  Invites: 'notifications.invites',
};

function getNotificationIcon(notification) {
  if (notification.eventType === 'member_joined') return 'person-add-outline';
  if (notification.eventType === 'message_sent') return 'chatbubble-ellipses-outline';
  if (notification.eventType === 'mention') return 'at-outline';
  if (notification.eventType === 'reaction') return 'heart-outline';
  if (notification.eventType === 'pulse_needed' || notification.eventType === 'room_revived') return 'pulse-outline';
  if (notification.eventType === 'room_expiring') return 'time-outline';
  if (notification.eventType === 'role_changed') return 'pricetag-outline';
  if (notification.type === '@') return 'at-outline';
  const title = notification.title.toLowerCase();
  if (title.includes('invited')) return 'people-outline';
  if (title.includes('liked')) return 'heart-outline';
  if (title.includes('reminder')) return 'notifications-outline';
  if (title.includes('accepted')) return 'checkmark-circle-outline';
  if (title.includes('followed')) return 'person-add-outline';
  return 'chatbubble-ellipses-outline';
}

export default function NotificationsScreen({ navigation }) {
  const {
    themeMode, notifications, readNotifIds, markNotifRead, markAllNotifsRead,
    unreadNotifCount, ensureRoomAvailable,
  } = useApp();
  const palette = getPalette(themeMode);
  const isDark  = palette.isDark;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [activeTab, setActiveTab] = useState('All');

  const readIds = readNotifIds;

  const handleNotifPress = async (n) => {
    markNotifRead(n.id);
    if (n.roomId) {
      const resolvedRoomId = await ensureRoomAvailable(n.roomId);
      const targetRoomId = resolvedRoomId || n.roomId;
      const isInvite = n.eventType === 'invite' || n.title.toLowerCase().includes('invited');
      const rootTabs = navigation.getParent('RootTabs');
      const roomTarget = {
        screen: isInvite ? 'JoinRoom' : 'Room',
        params: { roomId: targetRoomId, fromInvite: isInvite },
      };
      if (rootTabs) {
        rootTabs.navigate('Home', roomTarget);
      } else {
        navigation.navigate('Home', roomTarget);
      }
    }
  };


  const matchesTab = (n) => {
    if (activeTab === 'Unread')   return !readIds.includes(n.id);
    if (activeTab === 'Mentions') return n.type === '@' || n.eventType === 'mention';
    if (activeTab === 'Invites')  return n.title.toLowerCase().includes('invited') || n.eventType === 'invite';
    return true;
  };
  const newNotifs = notifications.filter(n => n.section === 'new');
  const oldNotifs = notifications.filter(n => n.section === 'old');
  const filteredNew = activeTab === 'All'
    ? newNotifs
    : notifications.filter(matchesTab);
  const filteredOld = activeTab === 'All' ? oldNotifs : [];

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
      <SafeAreaView style={styles.container}>
      <View style={[styles.page, isWide && styles.pageWide]}>

        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>{t('notifications.title')}</Text>
          <View style={styles.headerRight}>
            {unreadNotifCount > 0 && (
              <TouchableOpacity
                style={[styles.markAllBtn, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}
                onPress={markAllNotifsRead}
              >
                <Text style={[styles.markAllText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('notifications.markAllRead')}</Text>
              </TouchableOpacity>
            )}
          </View>
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
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted }]}>
                    {t(TAB_LABELS[tab])}{tab === 'Unread' && unreadNotifCount > 0 ? ` ${unreadNotifCount}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
          {filteredNew.length === 0 && activeTab === 'All' && filteredOld.length === 0 && (
            <View style={styles.emptyWrap}>
              <EmptyState
                iconName="notifications-outline"
                title={t('notifications.noNotifications')}
                subtitle={t('notifications.noNotificationsSub')}
              />
            </View>
          )}
          {filteredNew.length === 0 && activeTab !== 'All' && (
            <View style={styles.emptyWrap}>
              <EmptyState
                iconName={activeTab === 'Unread' ? 'checkmark-done-outline' : activeTab === 'Mentions' ? 'at-outline' : 'mail-unread-outline'}
                title={
                  activeTab === 'Unread'
                    ? t('notifications.noUnread')
                    : activeTab === 'Mentions'
                      ? t('notifications.noMentions')
                      : t('notifications.noInvites')
                }
                subtitle={
                  activeTab === 'Unread'
                    ? t('notifications.unreadSub')
                    : activeTab === 'Mentions'
                      ? t('notifications.mentionsSub')
                      : t('notifications.invitesSub')
                }
              />
            </View>
          )}

          {filteredNew.length > 0 && (
            <Text style={[styles.sectionLbl, { color: palette.text }]}>{activeTab === 'All' ? t('notifications.new') : t(TAB_LABELS[activeTab])}</Text>
          )}
          {filteredNew.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.ncard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }, !readIds.includes(n.id) && { backgroundColor: palette.glass.bgMedium }]}
              onPress={() => handleNotifPress(n)}
            >
              <View style={styles.avWrap}>
                <View style={[styles.av, { backgroundColor: n.avatarColor }]}>
                  <Text style={[styles.avText, { color: n.avatarText }]}>{n.avatar}</Text>
                </View>
                <View style={[styles.typeIcon, { backgroundColor: n.typeBg }]}>
                  <Ionicons name={getNotificationIcon(n)} size={10} color={colors.white} />
                </View>
              </View>
              <View style={styles.nbody}>
                <View style={styles.ntopRow}>
                  <Text style={[styles.ntitle, { color: palette.text }]}>{n.title}</Text>
                  <Text style={[styles.ntime, { color: palette.faint }]}>{n.time}</Text>
                </View>
                {n.room && <Text style={[styles.nroom, { color: n.roomColor }]}>{n.room}</Text>}
                <Text style={[styles.ndesc, { color: palette.muted }]}>{n.desc}</Text>
              </View>
              {!readIds.includes(n.id) && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}

          {filteredOld.length > 0 && (
            <Text style={[styles.sectionLbl, { marginTop: 8, color: palette.text }]}>{t('notifications.earlier')}</Text>
          )}
          {filteredOld.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[styles.ncardOld, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}
              onPress={() => handleNotifPress(n)}
            >
              <View style={styles.avWrap}>
                <View style={[styles.av, { backgroundColor: n.avatarColor }]}>
                  <Text style={[styles.avText, { color: n.avatarText }]}>{n.avatar}</Text>
                </View>
                <View style={[styles.typeIcon, { backgroundColor: n.typeBg }]}>
                  <Ionicons name={getNotificationIcon(n)} size={10} color={colors.white} />
                </View>
              </View>
              <View style={styles.nbody}>
                <View style={styles.ntopRow}>
                  <Text style={[styles.ntitle, { color: palette.text }]}>{n.title}</Text>
                  <Ionicons name="chevron-forward" size={15} color={palette.faint} />
                </View>
                <Text style={[styles.ndesc, { color: palette.muted }]}>{n.desc}</Text>
                <Text style={[styles.ntime, { color: palette.faint }]}>{n.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAllBtn: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  markAllText: { fontSize: 11, fontWeight: '600' },
  tabsWrap: { paddingHorizontal: 20, marginBottom: 14 },
  tabsBg: { borderRadius: radius.lg, padding: 4, flexDirection: 'row', borderWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontSize: 11, fontWeight: '600' },
  feed: { flex: 1, paddingHorizontal: 16 },
  sectionLbl: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  ncard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, marginBottom: 8, alignItems: 'flex-start', borderWidth: 1 },
  ncardOld: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, marginBottom: 8, alignItems: 'flex-start', borderWidth: 1 },
  avWrap: { position: 'relative', flexShrink: 0 },
  av: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 13, fontWeight: '700' },
  typeIcon: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  nbody: { flex: 1 },
  ntopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  ntitle: { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 6 },
  ntime: { fontSize: 10 },
  nroom: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  ndesc: { fontSize: 12, lineHeight: 17 },
  unreadDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.purple, marginTop: 4, flexShrink: 0 },
  emptyWrap: { alignItems: 'center', paddingTop: 44 },
});
