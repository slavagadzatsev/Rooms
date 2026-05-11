import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { colors, getPalette, radius } from '../theme';
import { haptics } from '../hooks/useHaptics';
import { navigationRef } from '../utils/navigationRef';

const FRESH_MS = 25000;
const VISIBLE_MS = 5200;

function getIconName(notification) {
  if (notification?.eventType === 'invite') return 'mail-unread-outline';
  if (notification?.eventType === 'mention') return 'at-outline';
  if (notification?.eventType === 'reaction') return 'heart-outline';
  if (notification?.eventType === 'member_joined') return 'person-add-outline';
  if (notification?.eventType === 'room_expiring') return 'time-outline';
  return 'notifications-outline';
}

function isFreshNotification(notification) {
  if (!notification?.createdAt) return false;
  const created = new Date(notification.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created < FRESH_MS;
}

export default function InAppNotificationBanner() {
  const {
    storageReady,
    backendUserId,
    themeMode,
    notifications,
    readNotifIds,
    markNotifRead,
    ensureRoomAvailable,
  } = useApp();
  const palette = getPalette(themeMode);
  const isDark = palette.isDark;
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const knownIdsRef = useRef(new Set());
  const hideTimerRef = useRef(null);
  const [activeNotification, setActiveNotification] = useState(null);

  const unreadFresh = useMemo(() => (
    notifications
      .filter(notification => notification?.id && !readNotifIds.includes(notification.id))
      .filter(isFreshNotification)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  ), [notifications, readNotifIds]);

  useEffect(() => {
    if (!storageReady || !backendUserId) {
      knownIdsRef.current = new Set(notifications.map(notification => notification.id));
      return;
    }

    const next = unreadFresh.find(notification => !knownIdsRef.current.has(notification.id));
    notifications.forEach(notification => {
      if (notification?.id) knownIdsRef.current.add(notification.id);
    });
    if (!next) return;

    haptics.light();
    setActiveNotification(next);
  }, [backendUserId, notifications, storageReady, unreadFresh]);

  useEffect(() => {
    if (!activeNotification) return undefined;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => hideBanner(), VISIBLE_MS);

    return () => clearTimeout(hideTimerRef.current);
  }, [activeNotification]);

  const hideBanner = () => {
    clearTimeout(hideTimerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setActiveNotification(null);
    });
  };

  const openNotification = async () => {
    const notification = activeNotification;
    if (!notification) return;
    haptics.select();
    hideBanner();
    markNotifRead(notification.id);

    if (notification.roomId) {
      const resolvedRoomId = await ensureRoomAvailable(notification.roomId);
      const targetRoomId = resolvedRoomId || notification.roomId;
      const isInvite = notification.eventType === 'invite' || String(notification.title || '').toLowerCase().includes('invited');
      navigationRef.current?.navigate('Main', {
        screen: 'Home',
        params: {
          screen: isInvite ? 'JoinRoom' : 'Room',
          params: { roomId: targetRoomId, fromInvite: isInvite },
        },
      });
      return;
    }

    navigationRef.current?.navigate('Main', { screen: 'Notifications' });
  };

  if (!activeNotification) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: Math.max(insets.top + 8, 18),
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openNotification}
        onLongPress={hideBanner}
        style={[styles.card, { borderColor: palette.glass.borderStrong }]}
      >
        <BlurView intensity={isDark ? 58 : 82} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={isDark
            ? ['rgba(107,92,231,0.34)', 'rgba(24,20,45,0.86)']
            : ['rgba(255,255,255,0.94)', 'rgba(243,241,255,0.86)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={[styles.iconWrap, { backgroundColor: activeNotification.typeBg || colors.purple }]}>
          <Ionicons name={getIconName(activeNotification)} size={18} color="#fff" />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {activeNotification.title || 'Rumo'}
          </Text>
          <Text style={[styles.desc, { color: palette.muted }]} numberOfLines={2}>
            {activeNotification.desc || activeNotification.room || ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.faint} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    minHeight: 72,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    shadowColor: colors.purple,
    shadowOpacity: 0.26,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '900',
  },
  desc: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
});
