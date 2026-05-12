import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, Image, Modal, Pressable,
  useWindowDimensions, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius } from '../theme';
import { roomIconColors, resolveRoomIcon } from '../data/mockRooms';
import { checkBackendHealth } from '../services/backendHealthService';
import { APP_CONFIG } from '../config/appConfig';
import { t } from '../i18n';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [detailsSheet, setDetailsSheet] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const {
    logout, profile, profileTags, themeMode, setAppearance, myRooms,
    connectionsCount, connections, toggleFollowMember, followedUserIds, notificationPrefs, updateNotificationPrefs,
    premiumSettings, updatePremiumSettings, blockedUserIds, unblockMember, rooms,
  } = useApp();
  const palette = getPalette(themeMode);
  const isDark  = palette.isDark;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const canShowDevTools = __DEV__ && APP_CONFIG.showDevTools;

  useEffect(() => {
    if (detailsSheet !== 'backend') return;
    let alive = true;
    setBackendLoading(true);
    checkBackendHealth()
      .then(result => {
        if (alive) setBackendHealth(result);
      })
      .catch(error => {
        if (alive) {
          setBackendHealth({
            configured: false,
            url: null,
            signedIn: false,
            userId: null,
            tables: [],
            error: error.message || 'Backend check failed',
          });
        }
      })
      .finally(() => {
        if (alive) setBackendLoading(false);
      });
    return () => { alive = false; };
  }, [detailsSheet]);

  const handleSignOut = () =>
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: logout },
    ]);

  const notificationOptions = [
    { key: 'enabled', label: t('profile.allNotifications'), desc: t('profile.allNotificationsDesc'), iconName: 'notifications-outline' },
    { key: 'messages', label: t('profile.messages'), desc: t('profile.messagesDesc'), iconName: 'chatbubble-ellipses-outline' },
    { key: 'mentions', label: t('profile.mentions'), desc: t('profile.mentionsDesc'), iconName: 'at-outline' },
    { key: 'invites', label: t('profile.invites'), desc: t('profile.invitesDesc'), iconName: 'mail-unread-outline' },
    { key: 'roomActivity', label: t('profile.roomActivity'), desc: t('profile.roomActivityDesc'), iconName: 'pulse-outline' },
    { key: 'roomExpiry', label: t('profile.roomExpiry'), desc: t('profile.roomExpiryDesc'), iconName: 'time-outline' },
  ];

  const premiumFeatures = [
    { iconName: 'color-palette-outline', title: t('profile.profileCardColor'), desc: t('profile.profileCardColorDesc') },
    { iconName: 'albums-outline', title: t('profile.roomCardColor'), desc: t('profile.roomCardColorDesc') },
    { iconName: 'add-circle-outline', title: t('profile.moreActiveRooms'), desc: t('profile.moreActiveRoomsDesc') },
    { iconName: 'archive-outline', title: t('profile.advancedArchive'), desc: t('profile.advancedArchiveDesc') },
  ];

  const premiumAccents = [
    { key: 'none',   label: 'Default', color: null },
    { key: 'violet', label: 'Violet',  color: '#6B5CE7' },
    { key: 'aqua',   label: 'Aqua',    color: '#0ea5e9' },
    { key: 'mint',   label: 'Mint',    color: '#22c55e' },
    { key: 'rose',   label: 'Rose',    color: '#ec4899' },
    { key: 'amber',  label: 'Amber',   color: '#f59e0b' },
  ];

  const guidelineItems = [
    { iconName: 'heart-outline', title: t('profile.respectPeople'), desc: t('profile.respectPeopleDesc') },
    { iconName: 'flag-outline', title: t('profile.reportProblems'), desc: t('profile.reportProblemsDesc') },
    { iconName: 'ban-outline', title: t('profile.blockWhenNeeded'), desc: t('profile.blockWhenNeededDesc') },
    { iconName: 'eye-off-outline', title: t('profile.autoHideSafety'), desc: t('profile.autoHideSafetyDesc') },
  ];

  const settings = [
    {
      iconName: 'notifications-outline',
      label: t('profile.notifications'),
      onPress: () => setDetailsSheet('notifications'),
    },
    {
      iconName: 'bookmark-outline',
      label: t('profile.savedRooms'),
      onPress: () => navigation.navigate('Rooms', { screen: 'RoomsMain', params: { initialTab: 'Saved' } }),
    },
    {
      iconName: 'color-palette-outline',
      label: t('profile.appearance'),
      hasTheme: true,
    },
    {
      iconName: 'shield-checkmark-outline',
      label: t('profile.privacy'),
      onPress: () => setDetailsSheet('privacy'),
    },
    {
      iconName: 'ban-outline',
      label: t('profile.blockedUsers'),
      onPress: () => setDetailsSheet('blocked'),
    },
    {
      iconName: 'flag-outline',
      label: t('profile.communityGuidelines'),
      onPress: () => setDetailsSheet('guidelines'),
    },
    ...(canShowDevTools ? [{
      iconName: 'server-outline',
      label: t('profile.backendStatus'),
      onPress: () => setDetailsSheet('backend'),
    }] : []),
    {
      iconName: 'help-circle-outline',
      label: t('profile.helpSupport'),
      onPress: () => setDetailsSheet('support'),
    },
    {
      iconName: 'log-out-outline',
      label: t('profile.signOut'),
      red: true,
      onPress: handleSignOut,
    },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
      <SafeAreaView style={styles.container}>
      <View style={[styles.page, isWide && styles.pageWide]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>{t('profile.title')}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Profile info */}
          <View style={[styles.profileCard, {
            backgroundColor: premiumSettings?.profileCardBg
              ? premiumSettings.profileCardBg + '2E'
              : palette.glass.bg,
            borderColor: premiumSettings?.profileCardBg
              ? premiumSettings.profileCardBg + 'CC'
              : palette.glass.border,
          }]}>
            <TouchableOpacity
              style={[styles.settingsBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="settings-outline" size={18} color={palette.muted} />
            </TouchableOpacity>
            <View style={styles.avWrap}>
              {profile.avatarUri ? (
                <Image source={{ uri: profile.avatarUri }} style={styles.av} />
              ) : (
                <View style={styles.av}>
                  <Text style={styles.avText}>{profile.name.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: palette.text }]}>{profile.name}</Text>
                <View style={styles.nameOnlineDot} />
              </View>
              {myRooms.some(r => r.isMine) && (
                <View style={styles.creatorBadge}>
                  <Text style={[styles.creatorText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('profile.creatorBadge')}</Text>
                </View>
              )}
              {!!profile.location && (
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={13} color={palette.muted} />
                  <Text style={[styles.locText, { color: palette.muted }]}>{profile.location}</Text>
                </View>
              )}
              {!!profile.bio && (
                <Text style={[styles.bio, { color: palette.muted }]}>{profile.bio}</Text>
              )}
              {!profile.bio && !profile.location && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('EditProfile')}
                  style={styles.profileNudge}
                  activeOpacity={0.72}
                >
                  <Text style={[styles.profileNudgeText, { color: palette.faint }]}>
                    {t('profile.addBioNudge')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
            {[
              { label: t('profile.statsRooms'), value: myRooms.length.toString(), sheet: 'rooms' },
              { label: t('profile.connections'), value: connectionsCount.toString(), sheet: 'connections' },
            ].map((stat, index) => (
              <TouchableOpacity
                key={stat.label}
                style={[styles.statItem, index < 1 && styles.statBorder, { borderRightColor: palette.glass.border }]}
                activeOpacity={stat.sheet ? 0.72 : 1}
                onPress={() => stat.sheet && setDetailsSheet(stat.sheet)}
              >
                <Text style={[styles.statValue, { color: palette.text }]}>{stat.value}</Text>
                <View style={styles.statLabelRow}>
                  <Text style={[styles.statLabel, { color: palette.faint }]}>{stat.label}</Text>
                  {!!stat.sheet && (
                    <Ionicons name="chevron-down" size={10} color={palette.faint} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tags card */}
          <View style={[styles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="pricetag-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.cardTitle, { color: palette.text }]}>{t('profile.myInterests')}</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                <Text style={styles.editLink}>{t('profile.edit')}</Text>
              </TouchableOpacity>
            </View>
            {profileTags.length === 0 ? (
              <TouchableOpacity
                style={[styles.tagsEmptyRow, { borderColor: palette.glass.purpleBorder }]}
                onPress={() => navigation.navigate('EditProfile')}
                activeOpacity={0.75}
              >
                <Ionicons name="add-circle-outline" size={17} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.tagsEmptyText, { color: isDark ? '#c4b8ff' : colors.purple }]}>
                  Add your interests
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.tagsGrid}>
                {profileTags.map(tag => (
                  <View key={tag.id} style={[styles.tagItem, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                    <View style={styles.tagTop}>
                      <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                      <Text style={[styles.tagName, { color: palette.text }]}>{tag.name}</Text>
                    </View>
                    <Text style={[styles.tagDesc, { color: palette.faint }]}>{tag.desc || t('profile.noTagDesc')}</Text>
                    {Array.isArray(tag.focusTags) && tag.focusTags.length > 0 && (
                      <View style={styles.focusTagsRow}>
                        {tag.focusTags.slice(0, 3).map(focus => (
                          <View key={focus} style={[styles.focusTagChip, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                            <Text style={[styles.focusTagText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{focus}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Premium card */}
          <View style={[styles.premiumCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
            <View style={[styles.premiumIconWrap, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
              <Ionicons name="sparkles-outline" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
            </View>
            <View style={styles.premiumInfo}>
              <Text style={[styles.premiumTitle, { color: palette.text }]}>{t('profile.premiumTitle')}</Text>
              <Text style={[styles.premiumDesc, { color: palette.muted }]}>{t('profile.premiumCardDesc')}</Text>
            </View>
            <TouchableOpacity
              style={styles.premiumBtn}
              onPress={() => setDetailsSheet('premium')}
            >
              <Text style={styles.premiumBtnText}>{t('profile.premiumOpen')}</Text>
            </TouchableOpacity>
          </View>

          {/* Settings card */}
          <View style={[styles.settingsCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
            {settings.map((setting, index) => (
              <TouchableOpacity
                key={setting.label}
                style={[styles.settingRow, index < settings.length - 1 && [styles.settingBorder, { borderBottomColor: palette.glass.border }]]}
                onPress={setting.onPress}
                activeOpacity={setting.hasTheme ? 1 : 0.7}
              >
                <View style={[
                  styles.settingIcon,
                  { backgroundColor: palette.glass.bgMedium },
                  setting.red && styles.settingIconRed,
                ]}>
                  <Ionicons
                    name={setting.iconName}
                    size={18}
                    color={setting.red ? colors.red : (isDark ? '#c4b8ff' : colors.purple)}
                  />
                </View>
                <Text style={[styles.settingLabel, { color: palette.text }, setting.red && styles.settingLabelRed]}>
                  {setting.label}
                </Text>

                {setting.hasTheme && (
                  <View style={[styles.themeToggle, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                    <TouchableOpacity
                      style={[styles.themeOpt, !isDark && [styles.themeOptActive, { backgroundColor: palette.glass.bgStrong }]]}
                      onPress={() => setAppearance('light')}
                    >
                      <Ionicons name="sunny-outline" size={12} color={!isDark ? palette.text : palette.faint} />
                      <Text style={[styles.themeOptText, { color: !isDark ? palette.text : palette.faint }]}>{t('profile.light')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.themeOpt, isDark && [styles.themeOptActive, { backgroundColor: palette.glass.bgStrong }]]}
                      onPress={() => setAppearance('dark')}
                    >
                      <Ionicons name="moon-outline" size={12} color={isDark ? palette.text : palette.faint} />
                      <Text style={[styles.themeOptText, { color: isDark ? palette.text : palette.faint }]}>{t('profile.dark')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!setting.hasTheme && (
                  <Ionicons name="chevron-forward" size={16} color={setting.red ? colors.red : palette.faint} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
      </SafeAreaView>

      <Modal
        visible={!!detailsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsSheet(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setDetailsSheet(null)}>
          <Pressable
            style={[
              styles.detailsSheet,
              {
                backgroundColor: isDark ? 'rgba(26,22,48,0.78)' : 'rgba(242,239,255,0.76)',
                borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(107,92,231,0.22)',
                shadowColor: isDark ? '#000' : colors.purple,
              },
            ]}
            onPress={() => {}}
          >
            <BlurView
              intensity={isDark ? 55 : 80}
              tint={isDark ? 'dark' : 'extraLight'}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.68)' : '#d8d4e8' }]} />
            <View style={styles.detailsHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons
                  name={
                    detailsSheet === 'rooms'
                      ? 'chatbubbles-outline'
                      : detailsSheet === 'notifications'
                        ? 'notifications-outline'
                      : detailsSheet === 'premium'
                        ? 'sparkles-outline'
                        : detailsSheet === 'guidelines'
                          ? 'flag-outline'
                          : detailsSheet === 'backend'
                            ? 'server-outline'
                          : detailsSheet === 'privacy'
                            ? 'shield-checkmark-outline'
                            : detailsSheet === 'blocked'
                              ? 'ban-outline'
                              : detailsSheet === 'support'
                                ? 'help-circle-outline'
                            : 'people-outline'
                  }
                  size={17}
                  color={isDark ? '#c4b8ff' : colors.purple}
                />
                <Text style={[styles.detailsTitle, { color: palette.text }]}>
                  {detailsSheet === 'rooms'
                    ? t('profile.myRooms')
                    : detailsSheet === 'notifications'
                      ? t('profile.notifications')
                      : detailsSheet === 'premium'
                        ? t('profile.premiumTitle')
                        : detailsSheet === 'guidelines'
                          ? t('profile.communityGuidelines')
                          : detailsSheet === 'backend'
                            ? t('profile.backendStatus')
                          : detailsSheet === 'privacy'
                            ? t('profile.privacy')
                            : detailsSheet === 'blocked'
                              ? t('profile.blockedUsers')
                              : detailsSheet === 'support'
                                ? t('profile.helpSupport')
                              : t('profile.connections')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.sheetCloseBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                onPress={() => setDetailsSheet(null)}
              >
                <Ionicons name="close" size={18} color={palette.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailsList}
              contentContainerStyle={[
                styles.detailsListContent,
                { paddingBottom: Math.max(insets.bottom + 16, 28) },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {detailsSheet === 'rooms' && (
                myRooms.length === 0 ? (
                  <Text style={[styles.connectionsEmpty, { color: palette.faint }]}>{t('profile.roomsEmpty')}</Text>
                ) : (
                  myRooms.map(room => (
                    <TouchableOpacity
                      key={room.id}
                      style={[styles.roomRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                      activeOpacity={0.76}
                      onPress={() => {
                        setDetailsSheet(null);
                        navigation.navigate('Rooms', { screen: 'Room', params: { roomId: room.id } });
                      }}
                    >
                      {(() => {
                        const resolved = resolveRoomIcon(room.icon);
                        const iColor   = roomIconColors[resolved] || colors.purple;
                        return (
                          <View style={[styles.roomIconSmall, { backgroundColor: iColor }]}>
                            {room.imageUri ? (
                              <Image source={{ uri: room.imageUri }} style={styles.roomIconImageSmall} />
                            ) : (
                              <Ionicons name={resolved.replace('-outline', '')} size={18} color="rgba(255,255,255,0.95)" />
                            )}
                          </View>
                        );
                      })()}
                      <View style={styles.connectionInfo}>
                        <Text style={[styles.connectionName, { color: palette.text }]} numberOfLines={1}>{room.title}</Text>
                        <Text style={[styles.connectionMeta, { color: palette.faint }]} numberOfLines={1}>
                          {(room.membersCount || 0)}/{room.maxMembers || 0} {t('room.members').toLowerCase()} · {room.daysLeft ?? room.lifetime} {t('room.days')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={17} color={palette.faint} />
                    </TouchableOpacity>
                  ))
                )
              )}

              {detailsSheet === 'connections' && (
                connections.length === 0 ? (
                  <Text style={[styles.connectionsEmpty, { color: palette.faint }]}>
                    {t('profile.connectionsEmpty')}
                  </Text>
                ) : (
                  connections.map(person => (
                    <TouchableOpacity
                      key={`${person.name}-${person.roomId}`}
                      style={[styles.connectionRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                      activeOpacity={0.76}
                      onPress={() => {
                        const room = rooms.find(r => r.id === person.roomId);
                        const fullMember = room
                          ? (room.members || []).find(m => m.name === person.name) || person
                          : person;
                        setSelectedConnection({ ...person, ...fullMember, roomTitle: person.roomTitle, roomId: person.roomId });
                      }}
                    >
                      <View style={[styles.connectionAv, { backgroundColor: person.color }]}>
                        <Text style={[styles.connectionAvText, { color: person.textColor }]}>{person.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={[styles.connectionName, { color: palette.text }]}>{person.name}</Text>
                        <Text style={[styles.connectionMeta, { color: palette.faint }]} numberOfLines={1}>
                          {person.role} · {person.roomTitle}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.unfollowBtn, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}
                        onPress={(e) => { e.stopPropagation?.(); toggleFollowMember(person); }}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="person-remove-outline" size={14} color={isDark ? '#c4b8ff' : colors.purple} />
                        <Text style={[styles.unfollowText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('profile.unfollow')}</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )
              )}

              {detailsSheet === 'notifications' && (
                <View style={styles.notificationSettingsList}>
                  {notificationOptions.map((option, index) => {
                    const value = !!notificationPrefs[option.key];
                    const disabled = option.key !== 'enabled' && !notificationPrefs.enabled;
                    return (
                      <View key={option.key}>
                        <View style={styles.notificationSettingRow}>
                          <View style={[styles.notificationSettingIcon, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                            <Ionicons name={option.iconName} size={16} color={isDark ? '#c4b8ff' : colors.purple} />
                          </View>
                          <View style={styles.notificationSettingText}>
                            <Text style={[styles.notificationSettingTitle, { color: disabled ? palette.faint : palette.text }]}>{option.label}</Text>
                            <Text style={[styles.notificationSettingDesc, { color: palette.faint }]}>{option.desc}</Text>
                          </View>
                          <Switch
                            value={value}
                            disabled={disabled}
                            onValueChange={(next) => updateNotificationPrefs({ [option.key]: next })}
                            trackColor={{ false: isDark ? 'rgba(255,255,255,0.12)' : '#e0e0e0', true: '#c9b6f8' }}
                            thumbColor={value ? colors.purple : colors.white}
                          />
                        </View>
                        {index < notificationOptions.length - 1 && (
                          <View style={[styles.notificationSettingDivider, { backgroundColor: palette.glass.border }]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {detailsSheet === 'premium' && (
                <View>
                  <View style={[styles.premiumIntroCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Ionicons name="sparkles-outline" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
                    <View style={styles.premiumIntroText}>
                      <Text style={[styles.premiumIntroTitle, { color: palette.text }]}>{t('profile.premiumIntroTitle')}</Text>
                      <Text style={[styles.premiumIntroDesc, { color: palette.muted }]}>
                        {t('profile.premiumIntroDesc')}
                      </Text>
                    </View>
                  </View>

                  {premiumFeatures.map(feature => (
                    <View key={feature.title} style={[styles.premiumFeatureRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                      <View style={[styles.premiumFeatureIcon, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                        <Ionicons name={feature.iconName} size={17} color={isDark ? '#c4b8ff' : colors.purple} />
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={[styles.connectionName, { color: palette.text }]}>{feature.title}</Text>
                        <Text style={[styles.connectionMeta, { color: palette.faint }]}>{feature.desc}</Text>
                      </View>
                    </View>
                  ))}

                  {/* ── {t('profile.profileCardColor')} ── */}
                  <View style={[styles.premiumControlCard, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                    <View style={styles.premiumControlHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.premiumControlTitle, { color: palette.text }]}>{t('profile.profileCardColor')}</Text>
                        <Text style={[styles.premiumControlDesc, { color: palette.faint }]}>
                          {t('profile.profileCardColorDesc')}
                        </Text>
                      </View>
                      {/* mini card preview */}
                      <View style={[styles.previewCard, {
                        backgroundColor: premiumSettings?.profileCardBg
                          ? premiumSettings.profileCardBg + '2E'
                          : palette.glass.bgStrong,
                        borderColor: premiumSettings?.profileCardBg
                          ? premiumSettings.profileCardBg + 'CC'
                          : palette.glass.border,
                      }]}>
                        <View style={[styles.previewCardAvatar, {
                          backgroundColor: premiumSettings?.profileCardBg || colors.purple,
                        }]} />
                        <View style={styles.previewCardLines}>
                          <View style={[styles.previewCardLine, { width: 32, backgroundColor: premiumSettings?.profileCardBg ? premiumSettings.profileCardBg + 'CC' : palette.glass.borderStrong }]} />
                          <View style={[styles.previewCardLine, { width: 20, backgroundColor: palette.glass.border }]} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.swatchRow}>
                      {premiumAccents.map(accent => {
                        const active = (premiumSettings?.profileCardBg ?? null) === accent.color;
                        return (
                          <TouchableOpacity
                            key={accent.key}
                            style={[
                              accent.color ? styles.swatchBtn : styles.swatchBtnNone,
                              accent.color
                                ? { backgroundColor: accent.color, borderColor: active ? colors.white : 'rgba(255,255,255,0.35)' }
                                : { borderColor: active ? palette.text : palette.glass.border, backgroundColor: palette.glass.bgStrong },
                              active && styles.swatchBtnActive,
                            ]}
                            onPress={() => updatePremiumSettings({ profileCardBg: accent.color })}
                            activeOpacity={0.78}
                          >
                            {active && !accent.color && <Ionicons name="checkmark" size={14} color={palette.text} />}
                            {active && accent.color && <Ionicons name="checkmark" size={14} color={colors.white} />}
                            {!active && !accent.color && <Ionicons name="close" size={13} color={palette.faint} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* ── {t('profile.roomCardColor')} ── */}
                  <View style={[styles.premiumControlCard, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                    <View style={styles.premiumControlHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.premiumControlTitle, { color: palette.text }]}>{t('profile.roomCardColor')}</Text>
                        <Text style={[styles.premiumControlDesc, { color: palette.faint }]}>
                          {t('profile.roomCardColorDesc')}
                        </Text>
                      </View>
                      {/* mini card preview */}
                      <View style={[styles.previewCard, {
                        backgroundColor: premiumSettings?.roomCardBg
                          ? premiumSettings.roomCardBg + '2E'
                          : palette.glass.bgStrong,
                        borderColor: premiumSettings?.roomCardBg
                          ? premiumSettings.roomCardBg + 'CC'
                          : palette.glass.border,
                      }]}>
                        <View style={[styles.previewCardIcon, {
                          backgroundColor: premiumSettings?.roomCardBg || colors.purple,
                        }]}>
                          <Ionicons name="sparkles" size={10} color={colors.white} />
                        </View>
                        <View style={styles.previewCardLines}>
                          <View style={[styles.previewCardLine, { width: 32, backgroundColor: premiumSettings?.roomCardBg ? premiumSettings.roomCardBg + 'CC' : palette.glass.borderStrong }]} />
                          <View style={[styles.previewCardLine, { width: 20, backgroundColor: palette.glass.border }]} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.swatchRow}>
                      {premiumAccents.map(accent => {
                        const active = (premiumSettings?.roomCardBg ?? null) === accent.color;
                        return (
                          <TouchableOpacity
                            key={accent.key}
                            style={[
                              accent.color ? styles.swatchBtn : styles.swatchBtnNone,
                              accent.color
                                ? { backgroundColor: accent.color, borderColor: active ? colors.white : 'rgba(255,255,255,0.35)' }
                                : { borderColor: active ? palette.text : palette.glass.border, backgroundColor: palette.glass.bgStrong },
                              active && styles.swatchBtnActive,
                            ]}
                            onPress={() => updatePremiumSettings({ roomCardBg: accent.color })}
                            activeOpacity={0.78}
                          >
                            {active && !accent.color && <Ionicons name="checkmark" size={14} color={palette.text} />}
                            {active && accent.color && <Ionicons name="checkmark" size={14} color={colors.white} />}
                            {!active && !accent.color && <Ionicons name="close" size={13} color={palette.faint} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <Text style={[styles.premiumStoreNote, { color: palette.faint }]}>
                    {t('profile.premiumNote')}
                  </Text>
                </View>
              )}

              {detailsSheet === 'guidelines' && (
                <View>
                  <View style={[styles.guidelineIntroCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Ionicons name="shield-checkmark-outline" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
                    <View style={styles.premiumIntroText}>
                      <Text style={[styles.premiumIntroTitle, { color: palette.text }]}>{t('profile.guidelinesIntroTitle')}</Text>
                      <Text style={[styles.premiumIntroDesc, { color: palette.muted }]}>
                        {t('profile.guidelinesIntroDesc')}
                      </Text>
                    </View>
                  </View>

                  {guidelineItems.map(item => (
                    <View key={item.title} style={[styles.guidelineRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                      <View style={[styles.premiumFeatureIcon, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                        <Ionicons name={item.iconName} size={17} color={isDark ? '#c4b8ff' : colors.purple} />
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={[styles.connectionName, { color: palette.text }]}>{item.title}</Text>
                        <Text style={[styles.connectionMeta, { color: palette.faint }]}>{item.desc}</Text>
                      </View>
                    </View>
                  ))}

                  <Text style={[styles.premiumStoreNote, { color: palette.faint }]}>
                    {t('profile.reportsReviewed')}
                  </Text>
                </View>
              )}

              {detailsSheet === 'backend' && (
                <View>
                  <View style={[styles.guidelineIntroCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Ionicons name="server-outline" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
                    <View style={styles.premiumIntroText}>
                      <Text style={[styles.premiumIntroTitle, { color: palette.text }]}>{t('profile.backendIntroTitle')}</Text>
                      <Text style={[styles.premiumIntroDesc, { color: palette.muted }]}>
                        {t('profile.backendIntroDesc')}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.backendSummary, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                    {[
                      { label: t('profile.configured'), value: backendHealth?.configured ? t('profile.yes') : t('profile.no'), ok: backendHealth?.configured },
                      { label: t('profile.signedIn'), value: backendHealth?.signedIn ? t('profile.yes') : t('profile.no'), ok: backendHealth?.signedIn },
                      { label: t('profile.projectUrl'), value: backendHealth?.url || t('profile.notSet'), ok: backendHealth?.configured },
                    ].map(item => (
                      <View key={item.label} style={styles.backendSummaryRow}>
                        <Text style={[styles.backendSummaryLabel, { color: palette.faint }]}>{item.label}</Text>
                        <View style={styles.backendSummaryValueRow}>
                          <Ionicons
                            name={item.ok ? 'checkmark-circle' : 'alert-circle-outline'}
                            size={14}
                            color={item.ok ? colors.green : colors.red}
                          />
                          <Text style={[styles.backendSummaryValue, { color: palette.text }]} numberOfLines={1}>{item.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.backendHeaderRow}>
                    <Text style={[styles.backendSectionTitle, { color: palette.text }]}>{t('profile.tables')}</Text>
                    <TouchableOpacity
                      style={[styles.backendRefreshBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                      onPress={() => {
                        setBackendLoading(true);
                        checkBackendHealth().then(setBackendHealth).finally(() => setBackendLoading(false));
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh-outline" size={14} color={palette.text} />
                      <Text style={[styles.backendRefreshText, { color: palette.text }]}>{backendLoading ? t('profile.checking') : t('profile.refresh')}</Text>
                    </TouchableOpacity>
                  </View>

                  {(backendHealth?.tables || []).map(table => (
                    <View key={table.name} style={[styles.backendTableRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                      <View style={styles.backendTableNameRow}>
                        <Ionicons
                          name={table.ok ? 'checkmark-circle' : 'close-circle-outline'}
                          size={16}
                          color={table.ok ? colors.green : colors.red}
                        />
                        <Text style={[styles.connectionName, { color: palette.text }]}>{table.name}</Text>
                      </View>
                      {!!table.error && (
                        <Text style={[styles.backendError, { color: palette.faint }]} numberOfLines={2}>{table.error}</Text>
                      )}
                    </View>
                  ))}

                  {!backendLoading && backendHealth?.tables?.length === 0 && (
                    <Text style={[styles.premiumStoreNote, { color: palette.faint }]}>
                      {t('profile.backendEmpty')}
                    </Text>
                  )}
                </View>
              )}

              {detailsSheet === 'privacy' && (
                <View>
                  <View style={[styles.guidelineIntroCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Ionicons name="shield-checkmark-outline" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
                    <View style={styles.premiumIntroText}>
                      <Text style={[styles.premiumIntroTitle, { color: palette.text }]}>{t('profile.privacyIntroTitle')}</Text>
                      <Text style={[styles.premiumIntroDesc, { color: palette.muted }]}>
                        {t('profile.privacyIntroDesc')}
                      </Text>
                    </View>
                  </View>

                  {[
                    { iconName: 'person-outline', title: t('profile.profileVisibility'), desc: t('profile.profileVisibilityDesc') },
                    { iconName: 'lock-closed-outline', title: t('profile.privateRooms'), desc: t('profile.privateRoomsDesc') },
                    { iconName: 'trash-outline', title: t('profile.accountDeletion'), desc: t('profile.accountDeletionDesc') },
                    { iconName: 'notifications-outline', title: t('profile.notifications'), desc: t('profile.notificationPrivacyDesc') },
                  ].map(item => (
                    <View key={item.title} style={[styles.guidelineRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                      <View style={[styles.premiumFeatureIcon, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                        <Ionicons name={item.iconName} size={17} color={isDark ? '#c4b8ff' : colors.purple} />
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={[styles.connectionName, { color: palette.text }]}>{item.title}</Text>
                        <Text style={[styles.connectionMeta, { color: palette.faint }]}>{item.desc}</Text>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.supportContactCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}
                    onPress={() => Linking.openURL(APP_CONFIG.legal.privacyUrl)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.supportContactLabel, { color: palette.faint }]}>{t('profile.privacyPolicy').toUpperCase()}</Text>
                    <View style={styles.supportContactRow}>
                      <Text style={[styles.supportContactValue, { color: isDark ? '#c4b8ff' : colors.purple, fontSize: 13 }]}>{t('profile.readPrivacyPolicy')}</Text>
                      <Ionicons name="open-outline" size={13} color={palette.faint} />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {detailsSheet === 'blocked' && (() => {
                // Build a list of unique blocked member objects from all rooms
                const seen = new Set();
                const blockedMembers = [];
                rooms.forEach(room => {
                  (room.members || []).forEach(member => {
                    const key = member.backendUserId
                      || (!String(member.id || '').startsWith('me') ? String(member.id) : null)
                      || `${member.name || 'unknown'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    if (blockedUserIds.includes(key) && !seen.has(key)) {
                      seen.add(key);
                      blockedMembers.push({ ...member, _key: key });
                    }
                  });
                });
                return blockedMembers.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
                    <Ionicons name="checkmark-circle-outline" size={36} color={palette.faint} />
                    <Text style={[styles.connectionsEmpty, { color: palette.faint }]}>{t('profile.noBlockedUsers')}</Text>
                  </View>
                ) : (
                  blockedMembers.map(member => (
                    <View key={member._key} style={[styles.connectionRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                      <View style={[styles.connectionAv, { backgroundColor: member.color || '#999', opacity: 0.5 }]}>
                        <Text style={[styles.connectionAvText, { color: member.textColor || '#fff' }]}>🚫</Text>
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={[styles.connectionName, { color: palette.text }]}>{member.name}</Text>
                        <Text style={[styles.connectionMeta, { color: palette.faint }]}>{t('profile.blockedStatus')}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.unfollowBtn, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}
                        onPress={() => {
                          Alert.alert(t('profile.unblockUser'), `${t('profile.unblock')} ${member.name}? ${t('profile.unblockConfirm')}`, [
                            { text: t('profile.cancel'), style: 'cancel' },
                            { text: t('profile.unblock'), onPress: () => unblockMember(member._key) },
                          ]);
                        }}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color={isDark ? '#c4b8ff' : colors.purple} />
                        <Text style={[styles.unfollowText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('profile.unblock')}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                );
              })()}

              {detailsSheet === 'support' && (
                <View>
                  <View style={[styles.guidelineIntroCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.borderStrong }]}>
                    <Ionicons name="mail-outline" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
                    <View style={styles.premiumIntroText}>
                      <Text style={[styles.premiumIntroTitle, { color: palette.text }]}>{t('profile.contactSupport')}</Text>
                      <Text style={[styles.premiumIntroDesc, { color: palette.muted }]}>
                        {t('profile.contactSupportDesc')}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.supportContactCard, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}
                    onPress={() => Linking.openURL(`mailto:${APP_CONFIG.legal.supportEmail}`)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.supportContactLabel, { color: palette.faint }]}>{t('profile.email')}</Text>
                    <View style={styles.supportContactRow}>
                      <Text style={[styles.supportContactValue, { color: palette.text }]}>{APP_CONFIG.legal.supportEmail}</Text>
                      <Ionicons name="open-outline" size={13} color={palette.faint} />
                    </View>
                  </TouchableOpacity>

                  <View style={[styles.supportContactCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.borderStrong }]}>
                    <Text style={[styles.supportContactLabel, { color: palette.faint }]}>{t('profile.version')}</Text>
                    <Text style={[styles.supportContactValue, { color: palette.text }]}>
                      {require('../../app.json')?.expo?.version ?? '1.0.0'}
                    </Text>
                  </View>

                  {!!t('profile.supportNote') && (
                    <Text style={[styles.premiumStoreNote, { color: palette.faint, marginTop: 6 }]}>
                      {t('profile.supportNote')}
                    </Text>
                  )}

                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Connection mini-profile ── */}
      <Modal
        visible={!!selectedConnection}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedConnection(null)}
      >
        <Pressable style={connStyles.backdrop} onPress={() => setSelectedConnection(null)}>
          <Pressable onPress={() => {}} style={[connStyles.sheet, { borderColor: palette.glass.border }]}>
            <BlurView intensity={isDark ? 38 : 72} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={isDark
                ? ['rgba(107,92,231,0.18)', 'rgba(240,59,255,0.08)', 'rgba(255,255,255,0.02)']
                : ['rgba(107,92,231,0.12)', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0.42)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <TouchableOpacity
              style={[connStyles.closeIcon, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
              onPress={() => setSelectedConnection(null)}
              activeOpacity={0.78}
            >
              <Ionicons name="close" size={18} color={palette.text} />
            </TouchableOpacity>

            <ScrollView
              style={connStyles.scroll}
              contentContainerStyle={connStyles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Avatar */}
              <View style={connStyles.avWrap}>
                <View style={[connStyles.avRing, { borderColor: (selectedConnection?.color || colors.purple) + '66' }]}>
                  <View style={[connStyles.av, { backgroundColor: selectedConnection?.color || colors.purple }]}>
                    {selectedConnection?.avatarUri ? (
                      <Image source={{ uri: selectedConnection.avatarUri }} style={connStyles.avImage} />
                    ) : (
                      <Text style={[connStyles.avText, { color: selectedConnection?.textColor || '#fff' }]}>
                        {(selectedConnection?.name || '').slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <Text style={[connStyles.name, { color: palette.text }]}>{selectedConnection?.name}</Text>

              {/* Role + online */}
              <View style={connStyles.metaRow}>
                {!!selectedConnection?.role && (
                  <View style={[connStyles.roleBadge, { backgroundColor: (selectedConnection?.color || colors.purple) + '1f', borderColor: (selectedConnection?.color || colors.purple) + '88' }]}>
                    <View style={[connStyles.roleDot, { backgroundColor: selectedConnection?.color || colors.purple }]} />
                    <Text style={[connStyles.roleText, { color: selectedConnection?.color || colors.purple }]}>{selectedConnection.role}</Text>
                  </View>
                )}
                <View style={[
                  connStyles.statusPill,
                  {
                    backgroundColor: selectedConnection?.online ? 'rgba(34,197,94,0.14)' : palette.glass.bg,
                    borderColor: selectedConnection?.online ? 'rgba(34,197,94,0.35)' : palette.glass.border,
                  },
                ]}>
                  <View style={[connStyles.statusDot, { backgroundColor: selectedConnection?.online ? colors.green : palette.faint }]} />
                  <Text style={[connStyles.statusText, { color: selectedConnection?.online ? colors.green : palette.faint }]}>
                    {selectedConnection?.online ? t('room.onlineNow') : t('room.offline')}
                  </Text>
                </View>
              </View>

              {/* Room */}
              {!!selectedConnection?.roomTitle && (
                <View style={[connStyles.roomPill, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <Ionicons name="chatbubbles-outline" size={12} color={palette.faint} />
                  <Text style={[connStyles.roomPillText, { color: palette.faint }]} numberOfLines={1}>{selectedConnection.roomTitle}</Text>
                </View>
              )}

              {/* About */}
              <View style={[connStyles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <View style={connStyles.cardTitleRow}>
                  <Ionicons name="person-circle-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
                  <Text style={[connStyles.cardTitle, { color: palette.text }]}>{t('room.about')}</Text>
                </View>
                <Text style={[connStyles.cardText, { color: palette.muted }]}>
                  {selectedConnection?.bio || selectedConnection?.goal || (selectedConnection?.role ? `${selectedConnection.role} in this room.` : 'Room member.')}
                </Text>
              </View>

              {/* Follow / Unfollow */}
              {(() => {
                const key = selectedConnection?.backendUserId
                  || (!String(selectedConnection?.id || '').startsWith('me') ? String(selectedConnection?.id || '') : null)
                  || `${selectedConnection?.name || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const isFollowed = followedUserIds.includes(key);
                return (
                  <TouchableOpacity
                    style={[
                      connStyles.followBtn,
                      isFollowed
                        ? { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }
                        : { backgroundColor: isDark ? 'rgba(107,92,231,0.62)' : 'rgba(107,92,231,0.88)', borderColor: isDark ? 'rgba(196,184,255,0.35)' : 'rgba(107,92,231,0.45)' },
                    ]}
                    onPress={() => {
                      toggleFollowMember(selectedConnection);
                    }}
                    activeOpacity={0.82}
                  >
                    <Ionicons
                      name={isFollowed ? 'checkmark-circle' : 'person-add-outline'}
                      size={16}
                      color={isFollowed ? (isDark ? '#c4b8ff' : colors.purple) : '#fff'}
                    />
                    <Text style={[connStyles.followBtnText, { color: isFollowed ? (isDark ? '#c4b8ff' : colors.purple) : '#fff' }]}>
                      {isFollowed ? t('room.following') : t('room.follow')}
                    </Text>
                  </TouchableOpacity>
                );
              })()}

              <TouchableOpacity style={connStyles.closeBtn} onPress={() => setSelectedConnection(null)}>
                <Text style={[connStyles.closeBtnText, { color: palette.muted }]}>{t('room.close')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const connStyles = StyleSheet.create({
  backdrop:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(4,2,16,0.52)', padding: 24 },
  sheet:       { width: '100%', maxWidth: 360, borderRadius: 28, borderWidth: 1, overflow: 'hidden', maxHeight: '80%' },
  closeIcon:   { position: 'absolute', top: 12, right: 12, zIndex: 10, width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:      {},
  content:     { padding: 20, paddingTop: 24, paddingBottom: 12, alignItems: 'center' },
  avWrap:      { marginBottom: 12 },
  avRing:      { padding: 3, borderRadius: 46, borderWidth: 2 },
  av:          { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avImage:     { width: 80, height: 80, borderRadius: 40 },
  avText:      { fontSize: 24, fontWeight: '700' },
  name:        { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' },
  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  roleDot:     { width: 6, height: 6, borderRadius: 3 },
  roleText:    { fontSize: 11, fontWeight: '700' },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  roomPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, maxWidth: '90%' },
  roomPillText:{ fontSize: 11, fontWeight: '600' },
  card:        { width: '100%', borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 12 },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cardTitle:   { fontSize: 12, fontWeight: '700' },
  cardText:    { fontSize: 12.5, lineHeight: 18 },
  followBtn:   { flexDirection: 'row', alignItems: 'center', gap: 7, width: '100%', justifyContent: 'center', borderWidth: 1, borderRadius: 16, paddingVertical: 13, marginBottom: 8 },
  followBtnText: { fontSize: 14, fontWeight: '800' },
  closeBtn:    { paddingVertical: 10 },
  closeBtnText:{ fontSize: 13, fontWeight: '600' },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  page: { flex: 1, width: '100%', alignSelf: 'center' },
  pageWide: { maxWidth: 640 },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '700' },
  settingsBtn: {
    position: 'absolute', top: 12, right: 12,
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    zIndex: 1,
  },
  profileCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: colors.purple,
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  avWrap: { position: 'relative' },
  av: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#c9b6f8', alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 24, fontWeight: '700', color: '#3C3489' },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  profileName: { fontSize: 20, fontWeight: '800', marginBottom: 5 },
  nameOnlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  creatorBadge: { backgroundColor: 'rgba(107,92,231,0.15)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  creatorText: { fontSize: 11, fontWeight: '600' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  locText: { fontSize: 12 },
  bio: { fontSize: 12, lineHeight: 18 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statBorder: { borderRightWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 10.5, fontWeight: '600', textAlign: 'center' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  card: { marginHorizontal: 16, marginBottom: 14, borderRadius: 22, padding: 14, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  editLink: { fontSize: 12, color: colors.purple, fontWeight: '500' },
  connectionsEmpty: { fontSize: 12.5, lineHeight: 18 },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  connectionAv: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  connectionAvText: { fontSize: 12, fontWeight: '800' },
  connectionInfo: { flex: 1 },
  connectionName: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  connectionMeta: { fontSize: 11 },
  unfollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unfollowText: { fontSize: 11, fontWeight: '800' },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,2,16,0.42)',
  },
  detailsSheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
    overflow: 'hidden',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    zIndex: 1,
  },
  detailsTitle: { fontSize: 17, fontWeight: '800' },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsList: { marginHorizontal: -2, zIndex: 1, flexShrink: 1 },
  detailsListContent: { flexGrow: 1 },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  roomIconSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  roomIconImageSmall: { width: '100%', height: '100%', borderRadius: 19 },
  notificationSettingsList: { gap: 0 },
  notificationSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
  },
  notificationSettingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationSettingText: { flex: 1 },
  notificationSettingTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 2 },
  notificationSettingDesc: { fontSize: 11.5, lineHeight: 16 },
  notificationSettingDivider: { height: 1, marginLeft: 45 },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagsEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  tagsEmptyText: { fontSize: 13, fontWeight: '700' },
  profileNudge: { marginTop: 4 },
  profileNudgeText: { fontSize: 11, fontWeight: '600' },
  tagItem: { width: '47%', borderWidth: 1, borderRadius: 16, padding: 10 },
  tagTop: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagName: { fontSize: 12, fontWeight: '700', flex: 1 },
  tagDesc: { fontSize: 10, lineHeight: 14 },
  focusTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  focusTagChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  focusTagText: { fontSize: 9, fontWeight: '700' },
  premiumCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  premiumIconWrap: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  premiumInfo: { flex: 1 },
  premiumTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  premiumDesc: { fontSize: 11 },
  premiumBtn: { backgroundColor: colors.purple, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  premiumBtnText: { fontSize: 11, fontWeight: '600', color: colors.white },
  premiumIntroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  premiumIntroText: { flex: 1 },
  premiumIntroTitle: { fontSize: 13.5, fontWeight: '900', marginBottom: 3 },
  premiumIntroDesc: { fontSize: 11.5, lineHeight: 16 },
  premiumFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 11,
    marginBottom: 8,
  },
  premiumFeatureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumControlCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 9,
  },
  premiumControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 11,
  },
  premiumControlTitle: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  premiumControlDesc: { fontSize: 11, lineHeight: 15 },
  // Mini card preview widget
  previewCard: {
    width: 68,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 0,
  },
  previewCardAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    flexShrink: 0,
  },
  previewCardIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewCardLines: { gap: 5 },
  previewCardLine: { height: 4, borderRadius: 2 },
  swatchRow: { flexDirection: 'row', gap: 9, flexWrap: 'wrap', marginBottom: 6 },
  swatchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchBtnNone: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchBtnActive: {
    shadowColor: colors.purple,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  premiumStoreNote: { fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  guidelineIntroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
  },
  guidelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 11,
    marginBottom: 8,
  },
  supportContactCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 8,
  },
  supportContactLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 5 },
  supportContactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  supportContactValue: { fontSize: 14, fontWeight: '900' },
  backendSummary: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    gap: 9,
  },
  backendSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backendSummaryLabel: { fontSize: 11, fontWeight: '800' },
  backendSummaryValueRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  backendSummaryValue: { fontSize: 11.5, fontWeight: '800', maxWidth: 190 },
  backendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backendSectionTitle: { fontSize: 13, fontWeight: '900' },
  backendRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backendRefreshText: { fontSize: 11, fontWeight: '800' },
  backendTableRow: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 10,
    marginBottom: 7,
  },
  backendTableNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  backendError: { fontSize: 10.5, lineHeight: 14, marginTop: 5 },
  settingsCard: { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  settingBorder: { borderBottomWidth: 1 },
  settingIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  settingIconRed: { backgroundColor: 'rgba(239,68,68,0.15)' },
  settingLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  settingLabelRed: { color: colors.red },
  themeToggle: { flexDirection: 'row', borderRadius: radius.pill, padding: 3, gap: 2, borderWidth: 1 },
  themeOpt: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  themeOptActive: {},
  themeOptText: { fontSize: 11 },
});


