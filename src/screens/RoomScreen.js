import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, Modal, Pressable, Image, Animated,
  LayoutAnimation, UIManager, Share, useWindowDimensions, PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useApp } from '../context/AppContext';
import { haptics } from '../hooks/useHaptics';
import { colors, getPalette, radius } from '../theme';
import { ROOM_TYPES, resolveRoomIcon, roomIconColors } from '../data/mockRooms';
import { getRoomInviteLink } from '../utils/inviteLinks';
import { t } from '../i18n';

const PRIVACY_LABELS = { public: 'Public', invite: 'Invite only', private: 'Private' };
const PRIVACY_ICONS = { public: 'earth-outline', invite: 'link-outline', private: 'lock-closed-outline' };
const ROLE_COLOR_PALETTE = ['#7C5CFC', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

function getMemberModerationKey(member) {
  if (member?.backendUserId) return member.backendUserId;
  if (member?.id && !String(member.id).startsWith('me')) return String(member.id);
  return `${member?.name || 'unknown'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateNextLayout() {
  LayoutAnimation.configureNext({
    duration: 260,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

function getDaysWord(days) {
  return days === 1 ? 'day' : 'days';
}

function getReactionEmoji(reaction = '') {
  return String(reaction).trim().split(/\s+/)[0] || '👍';
}

function getRoleColor(room, role, fallbackIndex = 0) {
  return room?.roleColors?.[role] || ROLE_COLOR_PALETTE[fallbackIndex % ROLE_COLOR_PALETTE.length];
}

function parseReactionSummary(summary = '') {
  const parts = String(summary || '').trim().split(/\s+/).filter(Boolean);
  const reactions = [];
  for (let i = 0; i < parts.length; i += 2) {
    const emoji = parts[i];
    const count = Number(parts[i + 1] || 1);
    if (emoji) reactions.push({ emoji, count: Number.isFinite(count) ? count : 1 });
  }
  return reactions;
}

function getImagePreviewStyle(attachment = {}) {
  const width = Number(attachment.width) || 240;
  const height = Number(attachment.height) || 180;
  const ratio = width / Math.max(height, 1);
  const previewWidth = ratio < 0.82 ? 176 : ratio > 1.45 ? 238 : 218;
  const previewHeight = Math.min(268, Math.max(128, previewWidth / Math.max(ratio, 0.1)));
  return { width: previewWidth, height: previewHeight };
}

// â”€â”€ Typing indicator component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NOTE: Animated.delay() uses useNativeDriver:true internally, which conflicts
// with color/opacity animations (useNativeDriver:false). Use setTimeout instead.
function TypingIndicator({ name, palette }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const timers = [];
    const startDot = (dot, offset) => {
      const t = setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, { toValue: 1,   duration: 280, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.3, duration: 560, useNativeDriver: true }), // rest
          ])
        ).start();
      }, offset);
      timers.push(t);
    };
    startDot(dot1, 0);
    startDot(dot2, 186);
    startDot(dot3, 372);
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <View style={tyStyles.row}>
      <View style={[tyStyles.bubble, { backgroundColor: palette.chatBubbleOther, borderColor: palette.chatBorder }]}>
        <Text style={[tyStyles.name, { color: palette.muted }]}>{name}</Text>
        <View style={tyStyles.dots}>
          <Animated.View style={[tyStyles.dot, { backgroundColor: palette.muted, opacity: dot1 }]} />
          <Animated.View style={[tyStyles.dot, { backgroundColor: palette.muted, opacity: dot2 }]} />
          <Animated.View style={[tyStyles.dot, { backgroundColor: palette.muted, opacity: dot3 }]} />
        </View>
      </View>
    </View>
  );
}

const tyStyles = StyleSheet.create({
  row:    { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 6 },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1 },
  name:   { fontSize: 12, fontWeight: '600' },
  dots:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:    { width: 7, height: 7, borderRadius: 4 },
});

function SwipeableMessage({ children, item, palette, isDark, onReply, onLongPress }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const readyRef = useRef(false);
  const swipeDistance = translateX.interpolate({
    inputRange: [-58, 0],
    outputRange: [52, 0],
    extrapolate: 'clamp',
  });
  const hintOpacity = translateX.interpolate({
    inputRange: [-30, -8, 0],
    outputRange: [1, 0.25, 0],
    extrapolate: 'clamp',
  });
  const hintScale = translateX.interpolate({
    inputRange: [-30, 0],
    outputRange: [1, 0.82],
    extrapolate: 'clamp',
  });

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => (
      gesture.dx < -3 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.28
    ),
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      gesture.dx < -7 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.35
    ),
    onPanResponderMove: (_, gesture) => {
      const nextX = Math.max(-58, Math.min(0, gesture.dx));
      translateX.setValue(nextX);
      if (nextX < -16 && !readyRef.current) {
        readyRef.current = true;
        haptics.light();
      }
      if (nextX > -8) readyRef.current = false;
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -16 || gesture.vx < -0.22) {
        haptics.success();
        onReply(item);
      }
      readyRef.current = false;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 5,
        speed: 18,
      }).start();
    },
    onPanResponderTerminate: () => {
      readyRef.current = false;
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [item, onReply, translateX]);

  return (
    <View style={styles.swipeWrap}>
      <Animated.View style={[
        styles.replySwipeHint,
        { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder },
        { opacity: hintOpacity, transform: [{ scale: hintScale }, { translateX: swipeDistance }] },
      ]}>
        <Ionicons name="arrow-undo-outline" size={17} color={isDark ? '#c4b8ff' : colors.purple} />
      </Animated.View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <Pressable onLongPress={() => onLongPress(item)} delayLongPress={350}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Members are derived from activeRoom.members - no hardcoded fallback

export default function RoomScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    rooms, roomMessages, sendMessage, loadRoomMessages, subscribeRoomMessages, loadRoom, subscribeRoomUpdates, reactToMessage, deleteMessage,
    updateMessageStatus, retryMessage, checkIn, pulseRoom, clearUnread, leaveRoom, profile, followedUserIds, blockedUserIds,
    toggleFollowMember, blockMember, unblockMember, kickMemberFromRoom, reportContent, chooseMyRoomRole, addRoomRole, updateRoomRoleColor, inviteConnectionToRoom,
    joinRoom, ensureRoomAvailable, themeMode, profileTags, connections,
  } = useApp();
  const palette  = getPalette(themeMode);
  const isDark   = palette.isDark;
  const { width } = useWindowDimensions();
  const chatPalette = {
    input: palette.glass.bgMedium,
    chatBubbleOther: palette.glass.bgMedium,
    chatBubbleMine: colors.purple,
    chatBorder: palette.glass.border,
  };
  const [message,       setMessage]       = useState('');
  const [infoVisible,   setInfoVisible]   = useState(false);
  const [typingName,    setTypingName]    = useState(null);
  const [menuMsg,       setMenuMsg]       = useState(null);
  const [replyTo,       setReplyTo]       = useState(null);
  const [liveOnline,    setLiveOnline]    = useState(0);
  const [confirmLeave,  setConfirmLeave]  = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [invitingId, setInvitingId] = useState(null);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showAttachmentTray, setShowAttachmentTray] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [openImage, setOpenImage] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedJoinRole, setSelectedJoinRole] = useState('Member');
  const [resolvingRoom, setResolvingRoom] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const didInitialScrollRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const previousChatCountRef = useRef(0);
  const messagesPollingRef = useRef(false);
  const roomPollingRef = useRef(false);
  const lastChatOffsetRef = useRef(0);

  const scrollToChatBottom = (animated = false) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 80);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 240);
  };

  const closeImageViewer = () => {
    setOpenImage(null);
    const offset = lastChatOffsetRef.current || 0;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToOffset({ offset, animated: false });
    });
    setTimeout(() => {
      scrollRef.current?.scrollToOffset({ offset, animated: false });
    }, 80);
  };

  const saveOpenImage = async () => {
    if (!openImage?.uri) return;
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Gallery access', 'Allow photo access to save this image.');
        return;
      }

      let localUri = openImage.uri;
      if (localUri.startsWith('data:')) {
        const [, mimeType = 'image/jpeg', base64 = ''] = localUri.match(/^data:(.*?);base64,(.*)$/) || [];
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        localUri = `${FileSystem.cacheDirectory}rumo-photo-${Date.now()}.${ext}`;
        await FileSystem.writeAsStringAsync(localUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (/^https?:\/\//i.test(localUri)) {
        const target = `${FileSystem.cacheDirectory}rumo-photo-${Date.now()}.jpg`;
        const downloaded = await FileSystem.downloadAsync(localUri, target);
        localUri = downloaded.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved', 'Photo saved to your gallery.');
    } catch (error) {
      Alert.alert('Not saved', error?.message || 'Could not save this photo.');
    }
  };

  const activeRoom = useMemo(
    () => rooms.find(r => r.id === route?.params?.roomId || r.backendRoomId === route?.params?.roomId),
    [rooms, route?.params?.roomId]
  );
  const openedFromInvite = route?.name === 'JoinRoom' || route?.params?.fromInvite;

  const roomId  = activeRoom?.id;
  const backendRoomId = activeRoom?.backendRoomId;
  const rawMembers = useMemo(() => activeRoom?.members || [], [activeRoom]);
  const blockedMemberNames = useMemo(() => new Set(
    rawMembers
      .filter(member => blockedUserIds.includes(getMemberModerationKey(member)))
      .map(member => member.name)
  ), [rawMembers, blockedUserIds]);
  const members = useMemo(() => rawMembers, [rawMembers]);
  const roleOptions = useMemo(() => {
    const roles = (activeRoom?.roomRoles || []).filter(role => String(role).toLowerCase() !== 'creator');
    return roles.length > 0 ? roles : ['Member'];
  }, [activeRoom?.roomRoles]);
  useEffect(() => {
    setSelectedJoinRole(roleOptions.includes('Member') ? 'Member' : roleOptions[0]);
  }, [activeRoom?.id, roleOptions.join('|')]);
  useEffect(() => {
    if (!activeRoom && route?.params?.roomId) {
      setResolvingRoom(true);
      ensureRoomAvailable(route.params.roomId)
        .catch(() => null)
        .finally(() => setResolvingRoom(false));
    }
  }, [activeRoom, route?.params?.roomId, ensureRoomAvailable]);
  const myMember = useMemo(
    () => members.find(m => m.name === 'Me' || m.name === profile.name || String(m.id).startsWith('me')),
    [members, profile.name]
  );
  const messages = useMemo(
    () => (roomMessages[roomId] || []).map(msg => {
      if (msg.mine || msg.type === 'system') return msg;
      return blockedMemberNames.has(msg.sender) ? { ...msg, blocked: true } : msg;
    }),
    [roomMessages, roomId, blockedMemberNames]
  );
  const daysLeft = activeRoom?.daysLeft ?? activeRoom?.lifetime ?? 0;
  const isArchived = activeRoom?.wasInRoom || (daysLeft <= 0 && !(activeRoom?.isMember || activeRoom?.isMine));
  const isParticipant = !!(activeRoom?.isMember || activeRoom?.isMine);
  const canJoinRoom = !!activeRoom
    && !isArchived
    && (activeRoom.privacy !== 'private' || openedFromInvite)
    && (activeRoom.membersCount || 0) < (activeRoom.maxMembers || 0);
  const pulseGoal = activeRoom?.pulseGoal || 1;
  const pulseCount = activeRoom?.pulseCount || 0;
  const pulseProgress = Math.min(pulseCount / pulseGoal, 1);
  const needsPulse = isParticipant && daysLeft > 0 && daysLeft <= 3;
  const hasPulsed = activeRoom?.hasPulsed ?? false;
  const aliveStreak = activeRoom?.aliveStreak ?? 0;
  const shouldShowPulseInfo = needsPulse || hasPulsed || pulseCount > 0;
  const activityEnabled = activeRoom?.type === 'project' || (activeRoom?.type === 'learning' && activeRoom?.checkinEnabled);
  const activityCount = activeRoom?.activeToday ?? 0;
  const activityGoal = activeRoom?.membersCount || members.length || 1;
  const activityProgress = Math.min(activityCount / Math.max(activityGoal, 1), 1);
  const selectedMemberKey = selectedMember
    ? selectedMember.backendUserId
      || (!String(selectedMember.id || '').startsWith('me') ? String(selectedMember.id) : null)
      || `${selectedMember.name || 'unknown'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : null;
  const selectedIsMe = selectedMember?.name === 'Me' || selectedMember?.name === profile.name || String(selectedMember?.id || '').startsWith('me');
  const selectedIsFollowed = !!selectedMemberKey && followedUserIds.includes(selectedMemberKey);
  const selectedIsBlocked = !!selectedMemberKey && blockedUserIds.includes(selectedMemberKey);
  const selectedSharedRooms = useMemo(() => {
    if (!selectedMember) return [];
    return rooms
      .filter(room => (room.members || []).some(member => member.id === selectedMember.id || member.name === selectedMember.name))
      .slice(0, 3);
  }, [rooms, selectedMember]);
  const selectedTagDetails = useMemo(() => {
    if (!activeRoom) return [];
    return (activeRoom.tags || []).slice(0, 3).map(tagName => {
      const profileTag = (profileTags || []).find(tag =>
        tag.name?.toLowerCase() === String(tagName).toLowerCase()
        || (tag.focusTags || []).some(focus => focus.toLowerCase() === String(tagName).toLowerCase())
      );
      return {
        name: tagName,
        desc: profileTag?.desc || profileTag?.focusTags?.slice(0, 2).join(', ') || `Interested in ${tagName}`,
      };
    });
  }, [activeRoom, profileTags]);
  const selectedCommonInterests = selectedTagDetails.filter(tag => (profileTags || []).some(profileTag =>
    profileTag.name?.toLowerCase() === String(tag.name).toLowerCase()
    || (profileTag.focusTags || []).some(focus => focus.toLowerCase() === String(tag.name).toLowerCase())
  ));
  const selectedMemberAbout = selectedMember?.bio
    || selectedMember?.goal
    || (selectedMember?.role ? `${selectedMember.role} in this room.` : 'Room member.');
  const getMemberRoleColor = (member, fallbackIndex = 0) =>
    getRoleColor(activeRoom, member?.role || 'Member', fallbackIndex);

  const findMessageMember = (msg) => {
    if (!msg) return null;
    if (msg.mine) return myMember || {
      id: 'me',
      name: profile.name || 'Me',
      role: myMember?.role || 'Member',
      avatarUri: profile.avatarUri,
      color: '#6B5CE7',
      textColor: '#fff',
      online: true,
    };
    return members.find(member =>
      (msg.senderId && member.backendUserId === msg.senderId)
      || member.name === msg.sender
    ) || null;
  };

  const openMessageMember = (msg) => {
    const member = findMessageMember(msg);
    if (member) setSelectedMember(member);
  };

  const openInfoMemberProfile = (member) => {
    setInfoVisible(false);
    setTimeout(() => setSelectedMember(member), 220);
  };
  const chatItems = useMemo(() => {
    const items = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const dateLabel = msg.dateLabel || 'Today';
      if (dateLabel !== lastDate) {
        items.push({ type: 'date', id: `date-${dateLabel}`, label: dateLabel });
        lastDate = dateLabel;
      }
      items.push({ type: 'message', ...msg });
    });
    return items;
  }, [messages]);

  // Hide tab bar inside room, restore on exit
  useEffect(() => {
    const TAB_BAR_WIDTH = Math.min(245, width - 70);
    const tabNav = navigation.getParent('RootTabs') ?? navigation.getParent();
    tabNav?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      tabNav?.setOptions({
        tabBarStyle: {
          display: 'flex',
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          marginHorizontal: (width - TAB_BAR_WIDTH) / 2,
          width: TAB_BAR_WIDTH,
          height: 60,
          paddingTop: 8, paddingBottom: 8, paddingHorizontal: 4,
          backgroundColor: 'transparent', borderTopWidth: 0,
          borderRadius: 30, overflow: 'hidden', elevation: 14,
        },
      });
    };
  }, [navigation, width]);

  // Clear unread on enter AND whenever new messages arrive while inside the room
  useEffect(() => { if (roomId) clearUnread(roomId); }, [roomId, messages.length]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    isNearBottomRef.current = true;
    previousChatCountRef.current = 0;
  }, [roomId]);

  useEffect(() => {
    if (!roomId || chatItems.length === 0) return;
    const previousCount = previousChatCountRef.current;
    previousChatCountRef.current = chatItems.length;

    if (!didInitialScrollRef.current) {
      scrollToChatBottom(false);
      return;
    }

    if (chatItems.length > previousCount && isNearBottomRef.current) {
      setTimeout(() => scrollToChatBottom(true), 60);
    }
  }, [roomId, chatItems.length]);

  useEffect(() => {
    if (roomId) loadRoomMessages(roomId, backendRoomId);
  }, [roomId, backendRoomId]);

  useEffect(() => {
    if (roomId) loadRoom(roomId);
  }, [roomId, activeRoom?.backendRoomId]);

  useEffect(() => {
    if (!roomId) return undefined;
    const subscription = subscribeRoomMessages(roomId);
    return () => subscription?.unsubscribe?.();
  }, [roomId, activeRoom?.backendRoomId]);

  useEffect(() => {
    if (!roomId) return undefined;
    const subscription = subscribeRoomUpdates(roomId);
    return () => subscription?.unsubscribe?.();
  }, [roomId, activeRoom?.backendRoomId]);

  // Realtime can be delayed on Expo tunnels or when Supabase publications are still settling.
  // Keep the open room honest by polling the server lightly while the chat is visible.
  useEffect(() => {
    if (!roomId) return undefined;
    const intervalId = setInterval(() => {
      if (messagesPollingRef.current) return;
      messagesPollingRef.current = true;
      loadRoomMessages(roomId, backendRoomId).finally(() => {
        messagesPollingRef.current = false;
      });
    }, 3000);
    return () => clearInterval(intervalId);
  }, [roomId, backendRoomId]);

  useEffect(() => {
    if (!roomId) return undefined;
    const intervalId = setInterval(() => {
      if (roomPollingRef.current) return;
      roomPollingRef.current = true;
      loadRoom(roomId);
      setTimeout(() => {
        roomPollingRef.current = false;
      }, 1200);
    }, 9000);
    return () => clearInterval(intervalId);
  }, [roomId]);

  // Sync liveOnline when room changes, then gently fluctuate it
  useEffect(() => {
    setLiveOnline(activeRoom?.online || 0);
  }, [activeRoom?.id]);

  useEffect(() => {
    const max = activeRoom?.membersCount || 1;
    const id = setInterval(() => {
      setLiveOnline(prev => {
        const delta = Math.random() > 0.55 ? 1 : -1;
        return Math.max(1, Math.min(max, prev + delta));
      });
    }, 14000);
    return () => clearInterval(id);
  }, [activeRoom?.id, activeRoom?.membersCount]);

  // Derived: detect @mention being typed (last @word in message with no space after)
  const mentionMatch = message.match(/@(\w*)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1] : null;
  const mentionResults = mentionQuery !== null
    ? members.filter(m =>
        m.name !== 'Me' &&
        m.name !== profile.name &&
        !blockedMemberNames.has(m.name) &&
        m.name.toLowerCase().startsWith(mentionQuery.toLowerCase())
      )
    : [];

  const insertMention = (name) => {
    haptics.light();
    setMessage(prev => prev.replace(/@(\w*)$/, `@${name} `));
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!roomId || (!message.trim() && !pendingAttachment)) return;
    haptics.success();
    const msgId = sendMessage(roomId, message.trim(), replyTo, pendingAttachment);
    setMessage('');
    setPendingAttachment(null);
    setReplyTo(null);
    setShowEmojiTray(false);
    setShowAttachmentTray(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleLongPress = (msg) => {
    haptics.heavy();
    setMenuMsg(msg);
  };

  const handleReact = (emoji) => {
    haptics.light();
    if (menuMsg) reactToMessage(roomId, menuMsg.id, emoji);
    setMenuMsg(null);
  };

  const handleReactionTap = (msg, emoji = null) => {
    if (!roomId || !msg?.id) return;
    haptics.light();
    reactToMessage(roomId, msg.id, emoji || getReactionEmoji(msg.reaction));
  };

  const handleCopy = async () => {
    haptics.light();
    if (menuMsg?.text) await Clipboard.setStringAsync(menuMsg.text);
    setMenuMsg(null);
  };

  const handleReply = () => {
    haptics.light();
    setReplyTo(menuMsg);
    setMenuMsg(null);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const startReply = (msg) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 90);
  };

  const handlePickPhoto = async () => {
    haptics.light();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('room.galleryAccess'), t('room.galleryAttachDesc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.18,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    setPendingAttachment({
      type: 'image',
      uri: asset.uri,
      dataUrl: asset.base64 ? `data:${mimeType};base64,${asset.base64}` : null,
      width: asset.width,
      height: asset.height,
      label: 'Photo',
    });
    setShowAttachmentTray(false);
    setShowEmojiTray(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const handleAttachment = () => {
    haptics.light();
    setShowEmojiTray(false);
    setShowAttachmentTray(prev => !prev);
  };

  const handleEmoji = () => {
    haptics.light();
    setShowAttachmentTray(false);
    setShowEmojiTray(prev => !prev);
  };

  const insertEmoji = (emoji) => {
    haptics.light();
    setMessage(prev => `${prev}${emoji}`);
    inputRef.current?.focus();
  };

  const handleShareInvite = async () => {
    if (!activeRoom?.id) return;
    haptics.light();
    const link = getRoomInviteLink(activeRoom.id);
    const message = `Join "${activeRoom.title}" on Rumo: ${link}`;
    try {
      await Clipboard.setStringAsync(link);
      await Share.share({ message, url: link, title: activeRoom.title });
    } catch {
      Alert.alert('Invite link copied', link);
    }
  };

  const handleReportRoom = () => {
    if (!activeRoom?.id) return;
    haptics.light();
    Alert.alert(t('room.reportRoom'), t('room.reviewQuestion'), [
      { text: t('room.cancel'), style: 'cancel' },
      {
        text: t('room.spam'),
        onPress: () => {
          reportContent({ type: 'room', roomId: activeRoom.id, targetId: activeRoom.id, targetName: activeRoom.title, reason: 'spam' });
          Alert.alert(t('room.reportSent'), t('room.reportRoomThanks'));
        },
      },
      {
        text: 'Violence or unsafe content',
        style: 'destructive',
        onPress: () => {
          reportContent({ type: 'room', roomId: activeRoom.id, targetId: activeRoom.id, targetName: activeRoom.title, reason: 'violence' });
          Alert.alert(t('room.reportSent'), t('room.reportRoomThanks'));
        },
      },
    ]);
  };

  const handleReportMember = () => {
    if (!selectedMember || !roomId) return;
    haptics.light();
    const targetId = getMemberModerationKey(selectedMember);
    Alert.alert(t('room.reportUser'), `${t('room.reportUserQuestion')} ${selectedMember.name}?`, [
      { text: t('room.cancel'), style: 'cancel' },
      {
        text: t('room.spam'),
        onPress: () => {
          reportContent({ type: 'user', roomId, targetId, targetName: selectedMember.name, reason: 'spam' });
          Alert.alert(t('room.reportSent'), t('room.reportUserThanks'));
        },
      },
      {
        text: t('room.harassment'),
        style: 'destructive',
        onPress: () => {
          reportContent({ type: 'user', roomId, targetId, targetName: selectedMember.name, reason: 'harassment' });
          Alert.alert(t('room.reportSent'), t('room.reportUserThanks'));
        },
      },
    ]);
  };

  const handleBlockMember = () => {
    if (!selectedMember) return;
    haptics.light();
    Alert.alert(t('room.blockUser'), t('room.blockUserQuestion'), [
      { text: t('room.cancel'), style: 'cancel' },
      {
        text: t('room.block'),
        style: 'destructive',
        onPress: () => {
          blockMember(selectedMember);
          setSelectedMember(null);
        },
      },
    ]);
  };

  const handleUnblockMember = () => {
    if (!selectedMember) return;
    haptics.light();
    Alert.alert(t('room.unblockUser'), `${t('room.unblock')} ${selectedMember.name}? ${t('room.unblockConfirm')}`, [
      { text: t('room.cancel'), style: 'cancel' },
      {
        text: t('room.unblock'),
        onPress: () => {
          unblockMember(selectedMember);
          setSelectedMember(null);
        },
      },
    ]);
  };

  const handleKickMember = () => {
    if (!selectedMember || !roomId) return;
    haptics.heavy();
    Alert.alert(t('room.kickFromRoom'), `${t('room.kickConfirm').replace('{name}', selectedMember.name)}`, [
      { text: t('room.cancel'), style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: () => {
          kickMemberFromRoom(roomId, selectedMember);
          setSelectedMember(null);
        },
      },
    ]);
  };

  const handleReportMessage = () => {
    if (!menuMsg || !roomId) return;
    haptics.light();
    const targetId = menuMsg.backendMessageId || menuMsg.id;
    Alert.alert(t('room.reportMessage'), t('room.reviewQuestion'), [
      { text: t('room.cancel'), style: 'cancel' },
      {
        text: t('room.spam'),
        onPress: () => {
          reportContent({ type: 'message', roomId, targetId, targetName: menuMsg.sender || 'Message', reason: 'spam' });
          setMenuMsg(null);
          Alert.alert(t('room.reportSent'), t('room.reportMessageThanks'));
        },
      },
      {
        text: t('room.harassment'),
        style: 'destructive',
        onPress: () => {
          reportContent({ type: 'message', roomId, targetId, targetName: menuMsg.sender || 'Message', reason: 'harassment' });
          setMenuMsg(null);
          Alert.alert(t('room.reportSent'), t('room.reportMessageThanks'));
        },
      },
    ]);
  };

  const getMessageStatusIcon = (status) => {
    if (status === 'failed') return 'alert-circle';
    if (status === 'read') return 'checkmark-done';
    if (status === 'delivered') return 'checkmark-done';
    return 'checkmark';
  };

  const handleOpenInvite = () => {
    haptics.medium();
    if (connections.length === 0) {
      handleShareInvite();
      return;
    }
    setInviteVisible(true);
  };

  const handleInviteConnection = async (person) => {
    if (!activeRoom?.id || invitingId) return;
    const personId = person.backendUserId || person.id;
    setInvitingId(personId);
    try {
      await inviteConnectionToRoom(activeRoom.id, person);
      haptics.success();
      Alert.alert('Invite sent', `${person.name || 'Connection'} will see it in Notifications.`);
    } catch (error) {
      Alert.alert('Invite not sent', error?.message || 'Please try again.');
    } finally {
      setInvitingId(null);
    }
  };

  const getMessageStatusColor = (status) => {
    if (status === 'read') return '#bff7df';
    if (status === 'delivered') return 'rgba(255,255,255,0.76)';
    return 'rgba(255,255,255,0.58)';
  };

  const renderEmptyChat = () => (
    <View style={[styles.emptyChatCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
      {(() => {
        const icon = resolveRoomIcon(activeRoom?.icon);
        const iconColor = roomIconColors[icon] || colors.purple;
        return (
          <View style={[styles.emptyChatIcon, { backgroundColor: iconColor }]}>
            {activeRoom?.imageUri
              ? <Image source={{ uri: activeRoom.imageUri }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
              : <Ionicons name={icon.replace('-outline', '')} size={32} color="rgba(255,255,255,0.95)" />
            }
          </View>
        );
      })()}
      <Text style={[styles.emptyChatTitle, { color: palette.text }]}>Start the conversation</Text>
      <Text style={[styles.emptyChatText, { color: palette.muted }]}>
        Share the first idea, task, or question for this room.
      </Text>
    </View>
  );

  const renderChatItem = ({ item }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateDividerWrap}>
          <View style={[styles.dateDivider, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
            <Text style={[styles.dateDividerText, { color: palette.muted }]}>{item.label}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'system') {
      return (
        <View style={styles.systemWrap}>
          <View style={[styles.systemBubble, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
            <Ionicons name="sparkles-outline" size={14} color={isDark ? '#c4b8ff' : colors.purple} />
            <Text style={[styles.systemText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{item.text}</Text>
          </View>
        </View>
      );
    }

    if (item.blocked) {
      const blockedMember = rawMembers.find(m => m.name === item.sender);
      return (
        <TouchableOpacity
          style={styles.blockedMsgWrap}
          onPress={() => blockedMember && setSelectedMember(blockedMember)}
          activeOpacity={0.72}
        >
          <View style={[styles.blockedMsgBubble, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
            <Ionicons name="ban-outline" size={13} color={palette.faint} />
            <Text style={[styles.blockedMsgText, { color: palette.faint }]}>
              {`${t('room.messageFrom') || 'Message from'} ${item.sender} · ${t('room.blockedMsgPlaceholder')}`}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    const messageMember = findMessageMember(item);
    const senderRoleColor = messageMember
      ? getMemberRoleColor(messageMember, members.findIndex(member => member.id === messageMember.id))
      : item.textColor;
    const avatarUri = item.avatarUri || messageMember?.avatarUri;

    return (
      <SwipeableMessage
        item={item}
        palette={palette}
        isDark={isDark}
        onReply={startReply}
        onLongPress={handleLongPress}
      >
        <View style={[styles.msgRow, item.mine && styles.msgRowMe]}>
          {!item.mine && (
            <TouchableOpacity
              style={[styles.msgAv, { backgroundColor: messageMember?.color || item.color }]}
              onPress={() => openMessageMember(item)}
              activeOpacity={0.75}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.msgAvImage} />
              ) : (
                <Text style={[styles.msgAvText, { color: messageMember?.textColor || item.textColor }]}>
                  {item.sender.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={[styles.msgBody, item.mine && styles.msgBodyMe]}>
            <View style={[
              styles.bubble,
              item.mine
                ? styles.bubbleMe
                : [styles.bubbleOther, { backgroundColor: chatPalette.chatBubbleOther, borderColor: chatPalette.chatBorder }],
            ]}>
              {!item.mine && (
                <Text
                  style={[styles.msgSender, { color: senderRoleColor || item.textColor }]}
                  numberOfLines={1}
                  onPress={() => openMessageMember(item)}
                >
                  {item.sender}
                </Text>
              )}
              {!!item.replyTo && (
                <View style={[
                  styles.quoteBlock,
                  item.mine
                    ? styles.quoteBlockMe
                    : [styles.quoteBlockOther, { borderColor: palette.glass.border, backgroundColor: palette.glass.bg }],
                ]}>
                  <View style={[styles.quoteAccent, { backgroundColor: item.mine ? 'rgba(255,255,255,0.5)' : (isDark ? '#c4b8ff' : colors.purple) }]} />
                  <View style={styles.quoteInner}>
                    <Text style={[styles.quoteName, { color: item.mine ? 'rgba(255,255,255,0.8)' : (isDark ? '#c4b8ff' : colors.purple) }]}>
                      {item.replyTo.sender === 'Me' ? 'You' : item.replyTo.sender}
                    </Text>
                    <Text style={[styles.quoteText, { color: item.mine ? 'rgba(255,255,255,0.65)' : palette.muted }]} numberOfLines={2}>
                      {item.replyTo.text}
                    </Text>
                  </View>
                </View>
              )}
              {item.attachment?.type === 'image' && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setOpenImage(item.attachment)}
                  style={styles.messageImageWrap}
                >
                  <Image
                    source={{ uri: item.attachment.uri }}
                    style={[styles.messageImage, getImagePreviewStyle(item.attachment)]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              {!!item.text && (
                <Text style={[styles.bubbleText, item.mine && { color: colors.white }, !item.mine && { color: palette.text }]}>
                  {item.text}
                </Text>
              )}
              <View style={[styles.bubbleMeta, item.mine && styles.bubbleMetaMe]}>
                <Text style={[styles.bubbleTime, { color: item.mine ? 'rgba(255,255,255,0.72)' : palette.faint }]}>{item.time}</Text>
                {item.mine && (
                  item.status === 'failed' ? (
                    <TouchableOpacity onPress={() => retryMessage(roomId, item.id)} hitSlop={8} activeOpacity={0.75}>
                      <Ionicons name="alert-circle" size={15} color="#fecaca" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons
                      name={getMessageStatusIcon(item.status || 'sent')}
                      size={14}
                      color={getMessageStatusColor(item.status || 'sent')}
                    />
                  )
                )}
              </View>
              {item.mine && item.status === 'failed' && (
                <TouchableOpacity onPress={() => retryMessage(roomId, item.id)} activeOpacity={0.75}>
                  <Text style={styles.failedText}>{item.sendError || 'Not sent'} · Tap to retry</Text>
                </TouchableOpacity>
              )}
            </View>

            {!!item.reaction && (() => {
              const reactions = parseReactionSummary(item.reaction);
              const visibleReactions = reactions.slice(0, 3);
              const hiddenCount = reactions.slice(3).reduce((sum, reaction) => sum + reaction.count, 0);
              return (
                <View style={[styles.reactionRow, item.mine && styles.reactionRowMe]}>
                  {visibleReactions.map(reaction => (
                    <TouchableOpacity
                      key={reaction.emoji}
                      style={[
                        styles.reaction,
                        { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder },
                      ]}
                      onPress={() => handleReactionTap(item, reaction.emoji)}
                      activeOpacity={0.72}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.reactionText}>{reaction.emoji} {reaction.count}</Text>
                    </TouchableOpacity>
                  ))}
                  {hiddenCount > 0 && (
                    <View style={[
                      styles.reaction,
                      { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                    ]}>
                      <Text style={[styles.reactionText, { color: palette.muted }]}>+{hiddenCount}</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </View>
      </SwipeableMessage>
    );
  };

  if (!activeRoom && resolvingRoom) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
        <Ionicons name="sync-outline" size={34} color={palette.faint} style={{ marginBottom: 10 }} />
        <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Opening room</Text>
        <Text style={{ color: palette.muted, fontSize: 13 }}>Loading invite details...</Text>
      </View>
    );
  }

  if (!activeRoom) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
        <Ionicons name="alert-circle-outline" size={34} color={palette.faint} style={{ marginBottom: 10 }} />
        <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Room not found</Text>
        <Text style={{ color: palette.muted, fontSize: 13, marginBottom: 18 }}>This room may have been archived or removed.</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.purple, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 11 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: colors.white, fontSize: 13, fontWeight: '800' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isParticipant) {
    const resolvedIcon = resolveRoomIcon(activeRoom.icon);
    const iconColor = roomIconColors[resolvedIcon] || colors.purple;
    const spotsLeft = Math.max(0, (activeRoom.maxMembers || 0) - (activeRoom.membersCount || 0));

    return (
      <View style={styles.root}>
        <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
        <SafeAreaView style={styles.joinGateSafe}>
          <View style={styles.joinGateTop}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
            </TouchableOpacity>
            <Text style={[styles.joinGateTopTitle, { color: palette.text }]}>
              {openedFromInvite ? t('roomPreview.invitePreview') : t('roomPreview.roomPreview')}
            </Text>
            <View style={{ width: 42 }} />
          </View>

          <ScrollView style={styles.joinGateScroll} contentContainerStyle={styles.joinGateContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.joinGateCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <BlurView intensity={isDark ? 36 : 70} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
              <View style={[styles.joinGateIcon, { backgroundColor: iconColor }]}>
                {activeRoom.imageUri ? (
                  <Image source={{ uri: activeRoom.imageUri }} style={styles.joinGateImage} />
                ) : (
                  <Ionicons name={resolvedIcon.replace('-outline', '')} size={34} color="rgba(255,255,255,0.96)" />
                )}
              </View>
              <Text style={[styles.joinGateTitle, { color: palette.text }]}>{activeRoom.title}</Text>
              <Text style={[styles.joinGateDesc, { color: palette.muted }]}>{activeRoom.desc}</Text>

              <View style={styles.joinGateMetaRow}>
                <View style={[styles.joinGateMeta, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <Ionicons name="people-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
                  <Text style={[styles.joinGateMetaText, { color: palette.text }]}>{activeRoom.membersCount}/{activeRoom.maxMembers}</Text>
                </View>
                <View style={[styles.joinGateMeta, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <Ionicons name="radio-button-on-outline" size={15} color={colors.green} />
                  <Text style={[styles.joinGateMetaText, { color: palette.text }]}>{activeRoom.online} {t('roomPreview.online')}</Text>
                </View>
                <View style={[styles.joinGateMeta, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <Ionicons name={PRIVACY_ICONS[activeRoom.privacy] || 'earth-outline'} size={15} color={palette.muted} />
                  <Text style={[styles.joinGateMetaText, { color: palette.text }]}>{PRIVACY_LABELS[activeRoom.privacy] || 'Public'}</Text>
                </View>
              </View>

              <View style={styles.joinGateTags}>
                {(activeRoom.tags || []).slice(0, 6).map(tag => (
                  <View key={tag} style={[styles.joinGateTag, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Text style={[styles.joinGateTagText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.joinGateCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <BlurView intensity={isDark ? 30 : 62} tint={isDark ? 'dark' : 'extraLight'} style={StyleSheet.absoluteFill} />
              <Text style={[styles.joinGateSectionTitle, { color: palette.text }]}>{t('roomPreview.chooseRole')}</Text>
              <View style={styles.joinGateRoles}>
                {roleOptions.map(role => {
                  const active = selectedJoinRole === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.joinGateRole,
                        { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                        active && { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder },
                      ]}
                      onPress={() => {
                        haptics.light();
                        setSelectedJoinRole(role);
                      }}
                      activeOpacity={0.76}
                    >
                      {active && <Ionicons name="checkmark-circle" size={14} color={isDark ? '#c4b8ff' : colors.purple} />}
                      <Text style={[styles.joinGateRoleText, { color: active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted }]}>{role}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.joinGateFooter}>
            <TouchableOpacity
              style={[styles.joinGateButton, !canJoinRoom && styles.joinGateButtonDisabled]}
              disabled={!canJoinRoom}
              onPress={() => {
                haptics.success();
                joinRoom(activeRoom.id, selectedJoinRole);
              }}
              activeOpacity={0.84}
            >
              <Text style={styles.joinGateButtonText}>
                {isArchived ? t('roomPreview.roomUnavailable') : activeRoom.privacy === 'private' ? t('roomPreview.privateRoom') : spotsLeft <= 0 ? t('roomPreview.roomFull') : `${t('roomPreview.joinAs')} ${selectedJoinRole}`}
              </Text>
              {canJoinRoom && <Ionicons name="arrow-forward" size={18} color={colors.white} />}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />

      <SafeAreaView style={styles.container}>

        {/* â”€â”€ Glassmorphic Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.headerOuter}>
        <View style={[styles.header, { borderColor: palette.glass.border }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerCenter, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
            onPress={() => setInfoVisible(true)}
            activeOpacity={0.78}
          >
            <View style={styles.headerTextWrap}>
              <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
                {activeRoom?.title || 'Room'}
              </Text>
              <View style={styles.headerSub}>
                <Text style={[styles.headerMeta, { color: palette.muted }]}>
                  {activeRoom?.membersCount || 0}/{activeRoom?.maxMembers || 0} {t('room.members').toLowerCase()}
                </Text>
                <View style={styles.onlineDot} />
                <Text style={styles.headerOnline}>{liveOnline} {t('roomPreview.online')}</Text>
                {!!activeRoom?.language && (
                  <>
                    <View style={[styles.headerDividerDot, { backgroundColor: palette.faint }]} />
                    <Text style={[styles.headerMeta, { color: palette.muted }]}>{activeRoom.language}</Text>
                  </>
                )}
              </View>
            </View>
            <Ionicons name="chevron-down" size={16} color={palette.faint} style={styles.headerInfoIcon} />
          </TouchableOpacity>

          {(() => {
            const _resolved = resolveRoomIcon(activeRoom?.icon);
            const _avColor  = roomIconColors[_resolved] || colors.purple;
            return (
              <TouchableOpacity
                style={[styles.roomAvBtn, { backgroundColor: _avColor, borderColor: 'rgba(255,255,255,0.18)' }]}
                onPress={() => setInfoVisible(true)}
                activeOpacity={0.75}
              >
                {activeRoom?.imageUri ? (
                  <Image source={{ uri: activeRoom.imageUri }} style={styles.roomAvImage} />
                ) : (
                  <Ionicons name={_resolved.replace('-outline', '')} size={22} color="rgba(255,255,255,0.95)" />
                )}
              </TouchableOpacity>
            );
          })()}
        </View>
        </View>

        {/* â”€â”€ Members strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={[styles.membersCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersList}>
            {members.map(member => {
              const isBlocked = blockedUserIds.includes(getMemberModerationKey(member));
              return (
                <TouchableOpacity key={member.id} style={styles.memberItem} onPress={() => setSelectedMember(member)} activeOpacity={0.75}>
                  <View style={styles.memberAvWrap}>
                    <View style={[styles.memberAv, { backgroundColor: member.color, opacity: isBlocked ? 0.45 : 1 }]}>
                      {member.avatarUri ? (
                        <Image source={{ uri: member.avatarUri }} style={styles.memberAvImage} />
                      ) : (
                        <Text style={[styles.memberAvText, { color: member.textColor }]}>
                          {isBlocked ? '🚫' : member.name.slice(0, 2).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    {!isBlocked && member.online && (
                      <View style={[styles.memberOnlineDot, { borderColor: isDark ? '#1a1630' : '#f5f3ff' }]} />
                    )}
                  </View>
                  <Text style={[styles.memberName, { color: isBlocked ? palette.faint : palette.text }]} numberOfLines={1}>
                    {member.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Invite button */}
            <View style={styles.memberItem}>
              <TouchableOpacity
                style={[styles.inviteBtn, { borderColor: isDark ? 'rgba(196,184,255,0.4)' : '#d0ccf8' }]}
                onPress={handleOpenInvite}
              >
                <Text style={[styles.inviteIcon, { color: isDark ? '#c4b8ff' : colors.purple }]}>+</Text>
              </TouchableOpacity>
              <Text style={[styles.memberName, { color: palette.muted }]}>Invite</Text>
            </View>
          </ScrollView>
        </View>

        {/* â”€â”€ Type-specific check-in widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {(activeRoom.type === 'project' || (activeRoom.type === 'learning' && activeRoom.checkinEnabled)) && !activeRoom.checkedInToday && (() => {
          const isProject  = activeRoom.type === 'project';
          const typeInfo   = ROOM_TYPES[activeRoom.type];
          const checkedIn  = activeRoom.checkedInToday ?? false;
          const activeToday = activeRoom.activeToday ?? 0;
          const progress   = isProject ? Math.min(activeToday / (activeRoom.membersCount || 1), 1) : null;
          return (
            <View style={[styles.checkinBar, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.checkinLeft}>
                <Text style={[styles.checkinTitle, { color: palette.text }]}>
                  {typeInfo.icon} {isProject ? "Today's activity" : "Today's study"}
                </Text>
                {isProject && (
                  <>
                    <View style={[styles.progressTrack, { backgroundColor: palette.glass.bgStrong }]}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={[styles.checkinSub, { color: palette.muted }]}>
                      {activeToday} / {activeRoom.membersCount} active
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.checkinBtn,
                  checkedIn
                    ? { backgroundColor: '#22c55e' }
                    : { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder, borderWidth: 1 },
                ]}
                onPress={() => {
                  haptics.success();
                  animateNextLayout();
                  checkIn(activeRoom.id);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.checkinBtnText, { color: checkedIn ? '#fff' : (isDark ? '#c4b8ff' : colors.purple) }]}>
                  {checkedIn
                    ? '✓ Done'
                    : isProject ? '+ I did it' : '+ I studied'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* â”€â”€ Room Pulse revive widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {needsPulse && !hasPulsed && (
          <View style={[styles.pulseCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
            <View style={styles.pulseTopRow}>
              <View style={styles.pulseTitleRow}>
                <View style={[styles.pulseIconWrap, { backgroundColor: colors.purple + '20', borderColor: palette.glass.purpleBorder }]}>
                  <Ionicons name="pulse-outline" size={18} color={isDark ? '#c4b8ff' : colors.purple} />
                </View>
                <View>
                  <Text style={[styles.pulseTitle, { color: palette.text }]}>Room Pulse</Text>
                  <Text style={[styles.pulseSub, { color: palette.muted }]}>
                    {daysLeft} {getDaysWord(daysLeft)} left · {pulseCount}/{pulseGoal} pulses
                  </Text>
                </View>
              </View>
              {aliveStreak > 0 && (
                <View style={[styles.streakBadge, { backgroundColor: colors.purple + '18', borderColor: palette.glass.purpleBorder }]}>
                  <Ionicons name="flame-outline" size={12} color={isDark ? '#c4b8ff' : colors.purple} />
                  <Text style={[styles.streakText, { color: isDark ? '#c4b8ff' : colors.purple }]}>
                    {aliveStreak}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.pulseTrack, { backgroundColor: palette.glass.bgStrong }]}>
              <View style={[styles.pulseFill, { width: `${pulseProgress * 100}%` }]} />
            </View>

            <View style={styles.pulseBottomRow}>
              <Text style={[styles.pulseHint, { color: palette.faint }]}>
                Team pulse revives this room for +7 days.
              </Text>
              <TouchableOpacity
                style={[
                  styles.pulseBtn,
                  hasPulsed
                    ? { backgroundColor: '#22c55e' }
                    : { backgroundColor: colors.purple },
                ]}
                onPress={() => {
                  haptics.success();
                  animateNextLayout();
                  pulseRoom(activeRoom.id);
                }}
                disabled={hasPulsed}
                activeOpacity={0.82}
              >
                <Ionicons name={hasPulsed ? 'checkmark-circle' : 'flame-outline'} size={15} color={colors.white} />
                <Text style={styles.pulseBtnText}>{hasPulsed ? 'Pulsed ✓' : 'Keep alive'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            ref={scrollRef}
            style={styles.chat}
            data={chatItems}
            renderItem={renderChatItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyChat}
            ListFooterComponent={(
              <>
                {typingName && (
                  <TypingIndicator
                    name={typingName}
                    palette={{ ...palette, chatBubbleOther: chatPalette.chatBubbleOther, chatBorder: chatPalette.chatBorder }}
                  />
                )}
                <View style={{ height: 20 }} />
              </>
            )}
            initialNumToRender={18}
            maxToRenderPerBatch={12}
            windowSize={9}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
            onLayout={() => {
              if (!didInitialScrollRef.current && chatItems.length > 0) {
                scrollToChatBottom(false);
              }
            }}
            onContentSizeChange={() => {
              if (!didInitialScrollRef.current && chatItems.length > 0) {
                scrollToChatBottom(false);
                setTimeout(() => {
                  scrollToChatBottom(false);
                  didInitialScrollRef.current = true;
                }, 220);
              }
            }}
              onScroll={({ nativeEvent }) => {
                lastChatOffsetRef.current = nativeEvent.contentOffset.y;
                const distanceFromBottom = nativeEvent.contentSize.height
                  - nativeEvent.layoutMeasurement.height
                  - nativeEvent.contentOffset.y;
                isNearBottomRef.current = distanceFromBottom < 120;
              }}
            scrollEventThrottle={80}
          />

          {/* â”€â”€ Archived banner (replaces input when room is left / expired) â”€â”€ */}
          {isArchived && (
            <View style={[styles.archivedBanner, { backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : '#fff4f4', borderColor: 'rgba(239,68,68,0.25)' }]}>
              <Ionicons name="archive-outline" size={16} color={colors.red} />
              <Text style={[styles.archivedBannerText, { color: colors.red }]}>
                {activeRoom?.wasInRoom ? 'You left this room' : 'This room has expired'}
              </Text>
            </View>
          )}

          {/* â”€â”€ Glass Input Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {!isArchived && <View style={styles.inputBarOuter}>
            {showAttachmentTray && (
              <View style={[styles.actionTray, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                {[
                  { iconName: 'image-outline', label: 'Photo', onPress: handlePickPhoto },
                ].map(item => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.actionTrayItem, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                    onPress={item.onPress}
                    activeOpacity={0.78}
                  >
                    <Ionicons name={item.iconName} size={18} color={isDark ? '#c4b8ff' : colors.purple} />
                    <Text style={[styles.actionTrayText, { color: palette.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {showEmojiTray && (
              <View style={[styles.emojiTray, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                {['👍', '❤️', '🔥', '😂', '🚀', '👏', '✅', '👀'].map(emoji => (
                  <TouchableOpacity key={emoji} style={styles.emojiTrayBtn} onPress={() => insertEmoji(emoji)} activeOpacity={0.72}>
                    <Text style={styles.emojiTrayText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* @mention autocomplete */}
            {mentionResults.length > 0 && (
              <View style={[styles.mentionPanel, { backgroundColor: isDark ? '#1a1630' : colors.white, borderColor: palette.glass.border }]}>
                {mentionResults.slice(0, 5).map((m, i) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.mentionRow,
                      i < mentionResults.slice(0, 5).length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.glass.border },
                    ]}
                    onPress={() => insertMention(m.name)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.mentionAv, { backgroundColor: m.color }]}>
                      <Text style={[styles.mentionAvText, { color: m.textColor }]}>{m.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.mentionInfo}>
                      <Text style={[styles.mentionName, { color: palette.text }]}>{m.name}</Text>
                      {m.role && <Text style={[styles.mentionRole, { color: palette.faint }]}>{m.role}</Text>}
                    </View>
                    {m.online && <View style={styles.mentionOnlineDot} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Reply preview bar */}
            {replyTo && (
              <View style={[styles.replyBar, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <View style={[styles.replyBarAccent, { backgroundColor: isDark ? '#c4b8ff' : colors.purple }]} />
                <View style={styles.replyBarContent}>
                  <Text style={[styles.replyBarName, { color: isDark ? '#c4b8ff' : colors.purple }]}>
                    {t('room.replyTo')} {replyTo.mine ? t('room.you') : replyTo.sender}
                  </Text>
                  <Text style={[styles.replyBarText, { color: palette.muted }]} numberOfLines={1}>
                    {replyTo.text}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.replyBarClose, { color: palette.faint }]}>x</Text>
                </TouchableOpacity>
              </View>
            )}

            {pendingAttachment && (
              <View style={[styles.attachmentPreview, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                {pendingAttachment.type === 'image' && (
                  <Image source={{ uri: pendingAttachment.uri }} style={styles.attachmentThumb} />
                )}
                <View style={styles.attachmentPreviewText}>
                  <Text style={[styles.attachmentPreviewTitle, { color: palette.text }]}>{t('room.photoAttached')}</Text>
                  <Text style={[styles.attachmentPreviewSub, { color: palette.faint }]}>{t('room.photoAttachedSub')}</Text>
                </View>
                <TouchableOpacity onPress={() => setPendingAttachment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color={palette.faint} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputBar}>
              <TouchableOpacity
                style={[styles.attachBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                onPress={handleAttachment}
                activeOpacity={0.82}
              >
                <Ionicons name="attach" size={22} color={isDark ? '#c4b8ff' : colors.purple} />
              </TouchableOpacity>
              <View style={[styles.inputPill, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: palette.text }]}
                  placeholder={t('room.message')}
                  placeholderTextColor={isDark ? '#8d8d96' : '#9a96a6'}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <TouchableOpacity style={styles.emojiBtn} onPress={handleEmoji} activeOpacity={0.75}>
                  <Ionicons name="happy-outline" size={22} color={palette.muted} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: (message.trim() || pendingAttachment)
                      ? (isDark ? 'rgba(107,92,231,0.72)' : 'rgba(107,92,231,0.9)')
                      : palette.glass.bgMedium,
                    borderColor: (message.trim() || pendingAttachment)
                      ? (isDark ? 'rgba(196,184,255,0.42)' : 'rgba(107,92,231,0.25)')
                      : palette.glass.border,
                  },
                  !(message.trim() || pendingAttachment) && styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={!(message.trim() || pendingAttachment)}
                activeOpacity={0.82}
              >
                <Ionicons name="send" size={17} color={(message.trim() || pendingAttachment) ? colors.white : palette.faint} />
              </TouchableOpacity>
            </View>
          </View>}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* â”€â”€ Room Info Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal visible={infoVisible} transparent animationType="slide"
        onRequestClose={() => { setInfoVisible(false); setConfirmLeave(false); }}>
        <Pressable style={styles.modalBackdrop} onPress={() => { setInfoVisible(false); setConfirmLeave(false); }} />
        <View style={[styles.infoSheet, { backgroundColor: isDark ? '#1a1630' : colors.white, borderColor: palette.glass.border }]}>
          <TouchableOpacity style={styles.sheetHandleHitbox} onPress={() => { setInfoVisible(false); setConfirmLeave(false); }} activeOpacity={0.75}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#dddddd' }]} />
          </TouchableOpacity>

          {/* Room identity */}
          <View style={styles.sheetHeader}>
            {(() => {
              const _r = resolveRoomIcon(activeRoom?.icon);
              const _c = roomIconColors[_r] || colors.purple;
              return (
                <View style={[styles.sheetIcon, { backgroundColor: _c }]}>
                  {activeRoom?.imageUri
                    ? <Image source={{ uri: activeRoom.imageUri }} style={styles.sheetIconImage} />
                    : <Ionicons name={_r.replace('-outline', '')} size={30} color='rgba(255,255,255,0.95)' />
                  }
                </View>
              );
            })()}
            <View style={styles.sheetTitleWrap}>
              <Text style={[styles.sheetTitle, { color: palette.text }]} numberOfLines={1}>
                {activeRoom?.title || 'Room'}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: palette.muted }]}>
                {activeRoom?.country || 'Germany'} · {activeRoom?.language || 'English'}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.infoScroll}
            contentContainerStyle={[
              styles.infoScrollContent,
              { paddingBottom: Math.max(insets.bottom + 40, 56) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >

            {/* Goal card */}
            <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.infoCardTitleRow}>
                <Ionicons name="flag-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.infoCardTitle, { color: palette.text }]}>{t('room.goal')}</Text>
              </View>
              <Text style={[styles.infoCardText, { color: palette.muted }]}>{activeRoom?.desc}</Text>
            </View>

            {/* Tags card */}
            <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.infoCardTitleRow}>
                <Ionicons name="pricetag-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.infoCardTitle, { color: palette.text }]}>{t('room.tags')}</Text>
              </View>
              <View style={styles.tagsRow}>
                {(activeRoom?.tags || []).map(tag => (
                  <View key={tag} style={[styles.tagChip, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
                    <Text style={[styles.tagChipText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Roles card */}
            <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.infoCardTitleRow}>
                <Ionicons name="people-circle-outline" size={16} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.infoCardTitle, { color: palette.text }]}>{t('room.teamRoles')}</Text>
              </View>
              <Text style={[styles.infoCardText, { color: palette.muted, marginBottom: 10 }]}>
                {t('room.rolesHint')}
              </Text>
              <View style={styles.roleWrap}>
                {roleOptions.map((role, index) => {
                  const active = myMember?.role === role;
                  const roleColor = getRoleColor(activeRoom, role, index);
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleChip,
                        { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                        active && { backgroundColor: `${roleColor}24`, borderColor: roleColor },
                      ]}
                      onPress={() => {
                        if (!activeRoom?.id) return;
                        haptics.success();
                        chooseMyRoomRole(activeRoom.id, role);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.roleColorDot, { backgroundColor: roleColor }]} />
                      {active && <Ionicons name="checkmark-circle" size={13} color={roleColor} />}
                      <Text style={[styles.roleChipText, { color: active ? roleColor : palette.muted }]}>
                        {role}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {activeRoom?.isMine && (
                <View style={styles.roleColorEditor}>
                  {roleOptions.map((role, index) => {
                    const activeColor = getRoleColor(activeRoom, role, index);
                    return (
                      <View key={`colors-${role}`} style={styles.roleColorRow}>
                        <View style={styles.roleColorLabelRow}>
                          <View style={[styles.roleColorDot, { backgroundColor: activeColor }]} />
                          <Text style={[styles.roleColorName, { color: palette.text }]} numberOfLines={1}>{role}</Text>
                        </View>
                        <View style={styles.roleSwatches}>
                          {ROLE_COLOR_PALETTE.map(color => (
                            <TouchableOpacity
                              key={`${role}-${color}`}
                              style={[
                                styles.roleSwatch,
                                { backgroundColor: color, borderColor: activeColor === color ? colors.white : 'rgba(255,255,255,0.22)' },
                                activeColor === color && styles.roleSwatchActive,
                              ]}
                              onPress={() => updateRoomRoleColor(activeRoom.id, role, color)}
                              activeOpacity={0.78}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              {activeRoom?.isMine && (
                <View style={[styles.addRoleRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                  <TextInput
                    style={[styles.addRoleInput, { color: palette.text }]}
                    value={newRoleName}
                    onChangeText={setNewRoleName}
                    placeholder={t('room.addCustomRole')}
                    placeholderTextColor={palette.faint}
                    maxLength={22}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (!activeRoom?.id || !newRoleName.trim()) return;
                      addRoomRole(activeRoom.id, newRoleName);
                      setNewRoleName('');
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.addRoleBtn, { backgroundColor: newRoleName.trim() ? colors.purple : palette.glass.bgStrong }]}
                    onPress={() => {
                      if (!activeRoom?.id || !newRoleName.trim()) return;
                      addRoomRole(activeRoom.id, newRoleName);
                      setNewRoleName('');
                    }}
                    disabled={!newRoleName.trim()}
                  >
                    <Ionicons name="add" size={18} color={newRoleName.trim() ? colors.white : palette.faint} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Activity status card */}
            {activityEnabled && (
              <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <View style={styles.infoCardTitleRow}>
                  <Ionicons name="radio-button-on-outline" size={16} color={isDark ? '#c4b8ff' : colors.purple} />
                  <Text style={[styles.infoCardTitle, { color: palette.text }]}>
                    {activeRoom?.type === 'learning' ? "Today's study" : "Today's activity"}
                  </Text>
                  <Text style={[styles.infoCardMeta, { color: palette.faint }]}>
                    {activityCount}/{activityGoal}
                  </Text>
                </View>
                <View style={[styles.infoPulseTrack, { backgroundColor: palette.glass.bgStrong }]}>
                  <View style={[styles.infoPulseFill, { width: `${activityProgress * 100}%`, backgroundColor: colors.green }]} />
                </View>
                <View style={styles.infoPulseFooter}>
                  <Text style={[styles.infoPulseText, { color: palette.muted }]}>
                    {activeRoom?.checkedInToday
                      ? 'You marked your progress today.'
                      : `${activityCount} people marked progress today.`}
                  </Text>
                  {!activeRoom?.checkedInToday && (
                    <TouchableOpacity
                      style={styles.infoPulseBtn}
                      onPress={() => {
                        haptics.success();
                        checkIn(activeRoom.id);
                      }}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.white} />
                      <Text style={styles.infoPulseBtnText}>I did it</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Pulse status card */}
            {shouldShowPulseInfo && (
            <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.infoCardTitleRow}>
                <Ionicons name="pulse-outline" size={16} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.infoCardTitle, { color: palette.text }]}>Room Pulse</Text>
                <Text style={[styles.infoCardMeta, { color: palette.faint }]}>
                  {pulseCount}/{pulseGoal}
                </Text>
              </View>
              <View style={[styles.infoPulseTrack, { backgroundColor: palette.glass.bgStrong }]}>
                <View style={[styles.infoPulseFill, { width: `${pulseProgress * 100}%` }]} />
              </View>
              <View style={styles.infoPulseFooter}>
                <Text style={[styles.infoPulseText, { color: palette.muted }]}>
                  {needsPulse
                    ? hasPulsed
                      ? 'Your pulse is counted. Waiting for the team.'
                      : 'This room needs team pulses to stay alive.'
                    : 'Pulse becomes important when the room is close to expiring.'}
                </Text>
                {needsPulse && !hasPulsed && (
                  <TouchableOpacity
                    style={styles.infoPulseBtn}
                    onPress={() => {
                      haptics.success();
                      pulseRoom(activeRoom.id);
                    }}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="flame-outline" size={14} color={colors.white} />
                    <Text style={styles.infoPulseBtnText}>Pulse</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            )}

            {/* Members card */}
            <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.infoCardTitleRow}>
                <Ionicons name="people-outline" size={16} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.infoCardTitle, { color: palette.text }]}>{t('room.members')}</Text>
                <Text style={[styles.infoCardMeta, { color: palette.faint }]}>
                  {members.length}/{activeRoom?.maxMembers ?? members.length}
                </Text>
              </View>
              <View style={styles.infoMembersList}>
                {members.map((member, index) => {
                  const roleColor = getRoleColor(activeRoom, member.role || 'Member', index);
                  const isBlocked = blockedUserIds.includes(getMemberModerationKey(member));
                  return (
                    <TouchableOpacity
                      key={`${member.id}-${member.name}`}
                      style={[styles.infoMemberRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border, opacity: isBlocked ? 0.6 : 1 }]}
                      onPress={() => openInfoMemberProfile(member)}
                      activeOpacity={0.78}
                    >
                      <View style={[styles.infoMemberAvatar, { backgroundColor: member.color }]}>
                        {member.avatarUri ? (
                          <Image source={{ uri: member.avatarUri }} style={styles.infoMemberAvatarImage} />
                        ) : (
                          <Text style={[styles.infoMemberAvatarText, { color: member.textColor }]}>
                            {isBlocked ? '🚫' : member.name.slice(0, 2).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.infoMemberBody}>
                        <Text style={[styles.infoMemberName, { color: palette.text }]} numberOfLines={1}>
                          {member.name}
                        </Text>
                        <Text style={[styles.infoMemberStatus, { color: isBlocked ? palette.faint : (member.online ? colors.green : palette.faint) }]}>
                          {isBlocked ? 'Blocked' : (member.online ? 'Online' : 'Offline')}
                        </Text>
                      </View>
                      <View style={[styles.infoMemberRole, { backgroundColor: `${roleColor}22`, borderColor: roleColor }]}>
                        <View style={[styles.roleColorDot, { backgroundColor: roleColor }]} />
                        <Text style={[styles.infoMemberRoleText, { color: roleColor }]} numberOfLines={1}>
                          {member.role || 'Member'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Details card */}
            <View style={[styles.infoCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              {[
                { iconName: PRIVACY_ICONS[activeRoom?.privacy] || 'earth-outline', label: t('room.privacy'), value: PRIVACY_LABELS[activeRoom?.privacy] || 'Public' },
                { iconName: 'people-outline',   label: t('room.members'), value: `${activeRoom?.membersCount ?? 0} / ${activeRoom?.maxMembers ?? 0}` },
                { iconName: 'time-outline',      label: t('room.lifetime'), value: `${activeRoom?.lifetime ?? 0} ${t('room.days')}` },
                { iconName: 'sparkles-outline',  label: t('room.createdBy'), value: activeRoom?.isMine ? t('room.you') : (activeRoom?.createdBy || t('room.unknown')) },
              ].map((row, i, arr) => (
                <View key={row.label}>
                  <View style={styles.infoRow}>
                    <Ionicons name={row.iconName} size={18} color={isDark ? '#c4b8ff' : colors.purple} style={styles.infoRowIcon} />
                    <Text style={[styles.infoRowLabel, { color: palette.muted }]}>{row.label}</Text>
                    <Text style={[styles.infoRowValue, { color: palette.text }]}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[styles.infoDivider, { backgroundColor: palette.glass.border }]} />}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.inviteLinkBtn, { borderColor: isDark ? 'rgba(196,184,255,0.5)' : colors.purple }]}
              onPress={handleShareInvite}
            >
              <Ionicons name="share-social-outline" size={18} color={isDark ? '#c4b8ff' : colors.purple} />
              <Text style={[styles.inviteLinkText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('room.shareInvite')}</Text>
            </TouchableOpacity>

            {!activeRoom?.isMine && (
              <TouchableOpacity
                style={[styles.moderationBtn, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}
                onPress={handleReportRoom}
                activeOpacity={0.78}
              >
                <Ionicons name="flag-outline" size={17} color={colors.red} />
                <Text style={[styles.moderationBtnText, { color: colors.red }]}>{t('room.reportRoom')}</Text>
              </TouchableOpacity>
            )}

            {confirmLeave ? (
              <View style={[styles.confirmLeaveBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fff0f0', borderColor: 'rgba(239,68,68,0.3)' }]}>
                <Text style={[styles.confirmLeaveTitle, { color: colors.red }]}>{t('room.leaveThisRoom')}</Text>
                <Text style={[styles.confirmLeaveSub, { color: palette.muted }]}>{t('room.leaveRoomSub')}</Text>
                <View style={styles.confirmLeaveRow}>
                  <TouchableOpacity
                    style={[styles.confirmLeaveCancel, { borderColor: palette.glass.border }]}
                    onPress={() => setConfirmLeave(false)}
                  >
                    <Text style={[styles.confirmLeaveCancelText, { color: palette.text }]}>{t('room.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmLeaveConfirm}
                    onPress={() => {
                      setConfirmLeave(false);
                      setInfoVisible(false);
                      leaveRoom(roomId);
                      navigation.goBack();
                    }}
                  >
                    <Text style={styles.confirmLeaveConfirmText}>{t('room.leave')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.leaveBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff0f0' }]}
                onPress={() => setConfirmLeave(true)}
              >
                <Text style={styles.leaveBtnText}>{t('room.leaveRoom')}</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* In-app invite sheet */}
      <Modal visible={inviteVisible} transparent animationType="fade" onRequestClose={() => setInviteVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setInviteVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.inviteSheet, { backgroundColor: isDark ? '#1a1630' : colors.white, borderColor: palette.glass.border }]}>
            <View style={styles.inviteSheetHeader}>
              <View>
                <Text style={[styles.inviteSheetTitle, { color: palette.text }]}>Invite connections</Text>
                <Text style={[styles.inviteSheetSub, { color: palette.muted }]}>Send an in-app invite notification.</Text>
              </View>
              <TouchableOpacity style={[styles.inviteSheetClose, { backgroundColor: palette.glass.bgMedium }]} onPress={() => setInviteVisible(false)}>
                <Ionicons name="close" size={18} color={palette.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.invitePeopleList} showsVerticalScrollIndicator={false}>
              {connections.map(person => {
                const personId = person.backendUserId || person.id;
                const isInviting = invitingId === personId;
                return (
                  <TouchableOpacity
                    key={personId}
                    style={[styles.invitePersonRow, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}
                    onPress={() => handleInviteConnection(person)}
                    disabled={!!invitingId}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.invitePersonAvatar, { backgroundColor: person.color || '#c9b6f8' }]}>
                      {person.avatarUri ? (
                        <Image source={{ uri: person.avatarUri }} style={styles.invitePersonAvatarImage} />
                      ) : (
                        <Text style={[styles.invitePersonAvatarText, { color: person.textColor || '#3C3489' }]}>
                          {(person.name || 'RM').slice(0, 2).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.invitePersonBody}>
                      <Text style={[styles.invitePersonName, { color: palette.text }]} numberOfLines={1}>{person.name || 'Member'}</Text>
                      <Text style={[styles.invitePersonMeta, { color: palette.faint }]} numberOfLines={1}>
                        {person.bio || person.role || 'Connection'}
                      </Text>
                    </View>
                    <View style={[styles.inviteSendBtn, { backgroundColor: isInviting ? palette.glass.bgMedium : colors.purple }]}>
                      <Ionicons name={isInviting ? 'time-outline' : 'paper-plane-outline'} size={16} color={colors.white} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.inviteLinkBtn, { borderColor: isDark ? 'rgba(196,184,255,0.5)' : colors.purple, marginBottom: 0 }]}
              onPress={() => {
                setInviteVisible(false);
                handleShareInvite();
              }}
              activeOpacity={0.78}
            >
              <Ionicons name="link-outline" size={18} color={isDark ? '#c4b8ff' : colors.purple} />
              <Text style={[styles.inviteLinkText, { color: isDark ? '#c4b8ff' : colors.purple }]}>Share invite link</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* â”€â”€ Member mini-profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal visible={!!selectedMember} transparent animationType="fade" onRequestClose={() => setSelectedMember(null)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setSelectedMember(null)}>
          <Pressable onPress={() => {}} style={[styles.memberProfileSheet, { borderColor: palette.glass.border }]}>
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
              style={[styles.memberProfileCloseIcon, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
              onPress={() => setSelectedMember(null)}
              activeOpacity={0.78}
            >
              <Ionicons name="close" size={18} color={palette.text} />
            </TouchableOpacity>

            <ScrollView
              style={styles.memberProfileScroll}
              contentContainerStyle={styles.memberProfileContent}
              showsVerticalScrollIndicator={false}
            >
            <View style={styles.memberProfileHero}>
              <View style={[styles.memberProfileAvRing, { borderColor: getMemberRoleColor(selectedMember) + '66' }]}>
                <View style={[styles.memberProfileAv, { backgroundColor: selectedMember?.color }]}>
                  {selectedMember?.avatarUri ? (
                    <Image source={{ uri: selectedMember.avatarUri }} style={styles.memberProfileAvImage} />
                  ) : (
                    <Text style={[styles.memberProfileAvText, { color: selectedMember?.textColor }]}>
                      {(selectedMember?.name || '').slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <Text style={[styles.memberProfileName, { color: palette.text }]}>{selectedMember?.name}</Text>
            <View style={styles.memberProfileMetaRow}>
              {(() => {
                const roleColor = getMemberRoleColor(selectedMember);
                return (
                  <View style={[styles.memberProfileRoleBadge, { backgroundColor: `${roleColor}1f`, borderColor: `${roleColor}88` }]}>
                    <View style={[styles.memberProfileRoleDot, { backgroundColor: roleColor }]} />
                    <Text style={[styles.memberProfileRoleText, { color: roleColor }]}>{selectedMember?.role}</Text>
                  </View>
                );
              })()}
              <View style={[
                styles.memberProfileStatusPill,
                {
                  backgroundColor: selectedMember?.online ? 'rgba(34,197,94,0.14)' : palette.glass.bg,
                  borderColor: selectedMember?.online ? 'rgba(34,197,94,0.35)' : palette.glass.border,
                },
              ]}>
                <View style={[styles.memberProfileStatusDot, { backgroundColor: selectedMember?.online ? colors.green : palette.faint }]} />
                <Text style={[styles.memberProfileStatusText, { color: selectedMember?.online ? colors.green : palette.faint }]}>
                  {selectedMember?.online ? t('room.onlineNow') : t('room.offline')}
                </Text>
              </View>
            </View>

            <View style={[styles.memberInsightCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.memberInsightTitleRow}>
                <Ionicons name="person-circle-outline" size={15} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.memberInsightTitle, { color: palette.text }]}>{t('room.about')}</Text>
              </View>
              <Text style={[styles.memberInsightText, { color: palette.muted }]}>
                {selectedMemberAbout}
              </Text>
            </View>

            <View style={styles.memberMiniStats}>
              <View style={[styles.memberMiniStat, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <Text style={[styles.memberMiniStatValue, { color: palette.text }]}>
                  {selectedSharedRooms.length || 1}
                </Text>
                <Text style={[styles.memberMiniStatLabel, { color: palette.faint }]}>{t('room.roomTogether')}</Text>
              </View>
              <View style={[styles.memberMiniStat, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                <Text style={[styles.memberMiniStatValue, { color: palette.text }]}>
                  {selectedCommonInterests.length || selectedTagDetails.length || 0}
                </Text>
                <Text style={[styles.memberMiniStatLabel, { color: palette.faint }]}>{t('room.sharedTags')}</Text>
              </View>
            </View>

            <View style={styles.memberTagsList}>
              {selectedTagDetails.map(tag => (
                <View key={tag.name} style={[styles.memberTagDetail, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
                  <Text style={[styles.memberTagName, { color: isDark ? '#c4b8ff' : colors.purple }]}>{tag.name}</Text>
                  <Text style={[styles.memberTagDesc, { color: palette.faint }]} numberOfLines={2}>{tag.desc}</Text>
                </View>
              ))}
            </View>

            {!selectedIsMe && (
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  selectedIsFollowed
                    ? { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }
                    : { backgroundColor: isDark ? 'rgba(107,92,231,0.62)' : 'rgba(107,92,231,0.88)', borderColor: isDark ? 'rgba(196,184,255,0.35)' : 'rgba(107,92,231,0.45)' },
                ]}
                onPress={() => {
                  haptics.success();
                  toggleFollowMember(selectedMember);
                }}
                activeOpacity={0.82}
              >
                <Ionicons
                  name={selectedIsFollowed ? 'checkmark-circle' : 'person-add-outline'}
                  size={16}
                  color={selectedIsFollowed ? (isDark ? '#c4b8ff' : colors.purple) : colors.white}
                />
                <Text style={[
                  styles.followBtnText,
                  { color: selectedIsFollowed ? (isDark ? '#c4b8ff' : colors.purple) : colors.white },
                ]}>
                  {selectedIsFollowed ? t('room.following') : t('room.follow')}
                </Text>
              </TouchableOpacity>
            )}
            {!selectedIsMe && (
              <View style={styles.memberModerationRow}>
                <TouchableOpacity
                  style={[styles.memberModerationBtn, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}
                  onPress={handleReportMember}
                  activeOpacity={0.78}
                >
                  <Ionicons name="flag-outline" size={15} color={colors.red} />
                  <Text style={[styles.memberModerationText, { color: colors.red }]}>{t('room.report')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.memberModerationBtn,
                    selectedIsBlocked
                      ? { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }
                      : { backgroundColor: palette.glass.bg, borderColor: palette.glass.border },
                  ]}
                  onPress={selectedIsBlocked ? handleUnblockMember : handleBlockMember}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name={selectedIsBlocked ? 'checkmark-circle-outline' : 'ban-outline'}
                    size={15}
                    color={selectedIsBlocked ? (isDark ? '#c4b8ff' : colors.purple) : colors.red}
                  />
                  <Text style={[styles.memberModerationText, { color: selectedIsBlocked ? (isDark ? '#c4b8ff' : colors.purple) : colors.red }]}>
                    {selectedIsBlocked ? t('room.unblock') : t('room.block')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!selectedIsMe && activeRoom?.isMine && (
              <TouchableOpacity
                style={[styles.kickBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : '#fff0f0', borderColor: 'rgba(239,68,68,0.25)' }]}
                onPress={handleKickMember}
                activeOpacity={0.78}
              >
                <Ionicons name="log-out-outline" size={15} color={colors.red} />
                <Text style={[styles.memberModerationText, { color: colors.red }]}>{t('room.kickFromRoom')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.memberProfileClose} onPress={() => setSelectedMember(null)}>
              <Text style={[styles.memberProfileCloseText, { color: palette.muted }]}>{t('room.close')}</Text>
            </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!openImage} transparent animationType="fade" onRequestClose={closeImageViewer}>
        <View style={styles.imageViewer}>
          <Pressable style={styles.imageViewerBackdrop} onPress={closeImageViewer} />
          <SafeAreaView style={styles.imageViewerSafe}>
            {!!openImage?.uri && (
              <Image source={{ uri: openImage.uri }} style={styles.imageViewerImage} resizeMode="contain" />
            )}
            <View style={styles.imageViewerActions}>
              <TouchableOpacity
                style={styles.imageViewerActionBtn}
                onPress={closeImageViewer}
                activeOpacity={0.82}
              >
                <Ionicons name="close" size={21} color="#fff" />
                <Text style={styles.imageViewerActionText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageViewerActionBtn, styles.imageViewerSaveBtn]}
                onPress={saveOpenImage}
                activeOpacity={0.82}
              >
                <Ionicons name="download-outline" size={21} color="#fff" />
                <Text style={styles.imageViewerActionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* â”€â”€ Long-press message menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal visible={!!menuMsg} transparent animationType="fade" onRequestClose={() => setMenuMsg(null)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuMsg(null)}>
          <Pressable onPress={() => {}} style={[styles.menuSheet, { backgroundColor: isDark ? '#1a1630' : colors.white, borderColor: palette.glass.border }]}>
            {/* Message preview */}
            <View style={[styles.menuPreview, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <Text style={[styles.menuPreviewText, { color: palette.text }]} numberOfLines={2}>{menuMsg?.text}</Text>
            </View>

            {/* Emoji reactions */}
            <View style={styles.menuReactions}>
              {['👍', '❤️', '🔥', '😂', '🚀', '👏'].map(emoji => (
                <TouchableOpacity key={emoji} style={styles.menuEmoji} onPress={() => handleReact(emoji)}>
                  <Text style={styles.menuEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.menuDivider, { backgroundColor: palette.glass.border }]} />

            {/* Actions */}
            <TouchableOpacity style={styles.menuAction} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={19} color={palette.text} style={styles.menuActionIcon} />
              <Text style={[styles.menuActionText, { color: palette.text }]}>{t('room.copyMessage')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuAction} onPress={handleReply}>
              <Ionicons name="return-up-back-outline" size={20} color={palette.text} style={styles.menuActionIcon} />
              <Text style={[styles.menuActionText, { color: palette.text }]}>{t('room.reply')}</Text>
            </TouchableOpacity>

            {menuMsg?.mine && (
              <TouchableOpacity style={styles.menuAction} onPress={() => {
                const msgId = menuMsg.id;
                haptics.medium();
                Alert.alert(t('room.deleteMessageTitle'), '', [
                  { text: t('room.cancel'), style: 'cancel' },
                  { text: t('room.delete'), style: 'destructive', onPress: () => {
                    deleteMessage(roomId, msgId);
                    setMenuMsg(null);
                  }},
                ]);
              }}>
                <Ionicons name="trash-outline" size={19} color={colors.red} style={styles.menuActionIcon} />
                <Text style={[styles.menuActionText, { color: colors.red }]}>{t('room.delete')}</Text>
              </TouchableOpacity>
            )}

            {!menuMsg?.mine && (
              <TouchableOpacity style={styles.menuAction} onPress={handleReportMessage}>
                <Ionicons name="flag-outline" size={19} color={colors.red} style={styles.menuActionIcon} />
                <Text style={[styles.menuActionText, { color: colors.red }]}>{t('room.reportMessage')}</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  container: { flex: 1 },

  // Header
  headerOuter: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 3,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 0, paddingVertical: 4,
    gap: 8,
    borderRadius: 0,
    borderWidth: 0,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  headerCenter: {
    flex: 1,
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15.5, fontWeight: '800', letterSpacing: 0 },
  headerSub:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerMeta:  { fontSize: 11 },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  headerOnline:{ fontSize: 11, color: colors.green, fontWeight: '500' },
  headerDividerDot: { width: 3, height: 3, borderRadius: 2, opacity: 0.8 },
  headerInfoIcon: { marginLeft: 1 },
  roomAvBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden',
  },
  roomAvIcon:  { fontSize: 20 },
  roomAvImage: { width: '100%', height: '100%', borderRadius: 21 },

  // Join gate
  joinGateSafe: { flex: 1 },
  joinGateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  joinGateTopTitle: { fontSize: 15, fontWeight: '900' },
  joinGateScroll: { flex: 1 },
  joinGateContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 112 },
  joinGateCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  joinGateIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  joinGateImage: { width: '100%', height: '100%' },
  joinGateTitle: { fontSize: 21, fontWeight: '900', textAlign: 'center', marginBottom: 7 },
  joinGateDesc: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 14 },
  joinGateMetaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 13 },
  joinGateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  joinGateMetaText: { fontSize: 11.5, fontWeight: '800' },
  joinGateTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  joinGateTag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  joinGateTagText: { fontSize: 11.5, fontWeight: '800' },
  joinGateSectionTitle: { alignSelf: 'flex-start', fontSize: 14, fontWeight: '900', marginBottom: 12 },
  joinGateRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'stretch' },
  joinGateRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  joinGateRoleText: { fontSize: 12.5, fontWeight: '800' },
  joinGateFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  joinGateButton: {
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.purple,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  joinGateButtonDisabled: { opacity: 0.48 },
  joinGateButtonText: { color: colors.white, fontSize: 15, fontWeight: '900' },

  // Members
  membersCard: {
    marginHorizontal: 12, marginTop: 6, marginBottom: 2,
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
  },
  membersList: { paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  memberItem:  { alignItems: 'center', marginRight: 9, width: 46 },
  memberAvWrap:{ position: 'relative', marginBottom: 3 },
  memberAv:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberAvImage: { width: '100%', height: '100%' },
  memberAvText:{ fontSize: 11.5, fontWeight: '700' },
  memberOnlineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.green, borderWidth: 2,
    position: 'absolute', bottom: 0, right: 0,
  },
  memberName:     { fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
  memberRoleBadge:{ borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  memberRoleText: { fontSize: 9, fontWeight: '600' },
  inviteBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 3,
  },
  inviteIcon: { fontSize: 22, fontWeight: '300' },

  // Chat
  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  dateDividerWrap: { alignItems: 'center', marginBottom: 10, marginTop: 2 },
  dateDivider: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dateDividerText: { fontSize: 11, fontWeight: '700' },
  emptyChatCard: {
    alignSelf: 'center',
    alignItems: 'center',
    width: '88%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginTop: 32,
  },
  emptyChatIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyChatEmoji: { fontSize: 28 },
  emptyChatTitle: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
  emptyChatText: { fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  msgRow:    { flexDirection: 'row', gap: 8, marginBottom: 7, alignItems: 'flex-end' },
  msgRowMe:  { flexDirection: 'row-reverse' },
  msgAv:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2, overflow: 'hidden' },
  msgAvImage: { width: '100%', height: '100%' },
  msgAvText: { fontSize: 10, fontWeight: '700' },
  msgBody:   { maxWidth: '82%' },
  msgBodyMe: { alignItems: 'flex-end' },
  msgSender: { fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  msgTimeSmall: { fontSize: 10 },
  myMsgMeta: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 3, justifyContent: 'flex-end' },
  readTick:  { fontSize: 11, fontWeight: '600' },
  swipeWrap: { position: 'relative' },
  replySwipeHint: {
    position: 'absolute',
    right: 18,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble:    {
    minWidth: 72,
    maxWidth: '100%',
    borderRadius: 20,
    paddingTop: 7,
    paddingBottom: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleOther: { borderBottomLeftRadius: 6, borderWidth: 1 },
  bubbleMe:    { backgroundColor: colors.purple, borderBottomRightRadius: 6 },
  messageImageWrap: { marginBottom: 7, borderRadius: 16, overflow: 'hidden' },
  messageImage: { borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.08)' },
  bubbleText:  { fontSize: 15, lineHeight: 20 },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 2,
  },
  bubbleMetaMe: { marginLeft: 8 },
  bubbleTime: { fontSize: 10.5, fontWeight: '500' },
  bubbleTicks: { fontSize: 10.5, color: 'rgba(255,255,255,0.78)', fontWeight: '700' },
  failedText: {
    color: '#fecaca',
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 2,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 3,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  reactionRowMe: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  reaction:   {
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1,
  },
  reactionText: { fontSize: 12 },
  systemWrap: { alignItems: 'center', marginBottom: 10 },
  systemBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '88%',
  },
  systemText: { fontSize: 11.5, fontWeight: '700', textAlign: 'center' },

  // Check-in widget
  checkinBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 12, marginTop: 6, marginBottom: 2,
    borderRadius: 16, borderWidth: 1, padding: 12, gap: 10,
  },
  checkinLeft:  { flex: 1, gap: 5 },
  checkinTitle: { fontSize: 12.5, fontWeight: '700' },
  checkinSub:   { fontSize: 11 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3, backgroundColor: '#22c55e' },
  checkinBtn: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  checkinBtnText: { fontSize: 12, fontWeight: '700' },

  // Room Pulse widget
  pulseCard: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    gap: 10,
  },
  pulseTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pulseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pulseIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pulseTitle: { fontSize: 13.5, fontWeight: '800' },
  pulseSub: { fontSize: 11.5, marginTop: 2 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  streakText: { fontSize: 11, fontWeight: '800' },
  pulseTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  pulseFill: { height: '100%', borderRadius: 3, backgroundColor: colors.purple },
  pulseBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pulseHint: { flex: 1, fontSize: 11, lineHeight: 15 },
  pulseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  pulseBtnText: { fontSize: 12, fontWeight: '800', color: colors.white },

  // Reply bar (above input)
  replyBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  replyBarAccent: { width: 3, height: 34, borderRadius: 2 },
  replyBarContent: { flex: 1 },
  replyBarName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyBarText: { fontSize: 12, lineHeight: 16 },
  replyBarClose: { fontSize: 16, lineHeight: 18, paddingHorizontal: 4 },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 9,
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
  },
  attachmentThumb: { width: 42, height: 42, borderRadius: 12 },
  attachmentPreviewText: { flex: 1 },
  attachmentPreviewTitle: { fontSize: 12.5, fontWeight: '800', marginBottom: 2 },
  attachmentPreviewSub: { fontSize: 11 },

  // Quote block inside bubble
  quoteBlock: {
    flexDirection: 'row', gap: 7,
    minWidth: 172,
    maxWidth: 238,
    borderRadius: 12, padding: 9,
    marginBottom: 6, overflow: 'hidden',
  },
  quoteBlockMe: { backgroundColor: 'rgba(255,255,255,0.15)' },
  quoteBlockOther: { borderWidth: 1 },
  quoteAccent: { width: 3, borderRadius: 2, flexShrink: 0 },
  quoteInner: { flex: 1 },
  quoteName: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  quoteText: { fontSize: 12.5, lineHeight: 17 },

  // @mention panel
  mentionPanel: {
    marginHorizontal: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  mentionAv: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mentionAvText: { fontSize: 10, fontWeight: '800' },
  mentionInfo: { flex: 1 },
  mentionName: { fontSize: 13, fontWeight: '700' },
  mentionRole: { fontSize: 11, marginTop: 1 },
  mentionOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
    flexShrink: 0,
  },
  actionTray: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
  },
  actionTrayItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
  },
  actionTrayText: { fontSize: 11, fontWeight: '700' },
  emojiTray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginHorizontal: 10,
    marginBottom: 7,
    borderWidth: 1,
    borderRadius: 20,
    padding: 8,
  },
  emojiTrayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiTrayText: { fontSize: 21 },

  // Input bar
  inputBarOuter: {
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
  },
  inputBarBg:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 7, gap: 8 },
  attachBtn:     {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 15,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 20,
  },
  emojiBtn:       { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  sendBtn:        {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  sendBtnDisabled:{ opacity: 0.72 },

  // Info modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  infoSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    paddingTop: 10,
  },
  sheetHandleHitbox: { alignSelf: 'center', paddingHorizontal: 44, paddingTop: 2, paddingBottom: 12 },
  sheetHandle:    { width: 38, height: 4, borderRadius: 2 },
  sheetHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
  sheetIcon:      { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetIconText:  { fontSize: 26 },
  sheetIconImage: { width: '100%', height: '100%', borderRadius: 18 },
  sheetTitleWrap: { flex: 1 },
  sheetTitle:     { fontSize: 17, fontWeight: '800' },
  sheetSubtitle:  { fontSize: 12, marginTop: 3 },
  infoScroll:     { paddingHorizontal: 16, flexShrink: 1 },
  infoScrollContent: { flexGrow: 1 },
  infoCard:       { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  infoCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  infoCardTitle:  { fontSize: 13, fontWeight: '700' },
  infoCardMeta: { marginLeft: 'auto', fontSize: 12, fontWeight: '800' },
  infoCardText:   { fontSize: 13, lineHeight: 20 },
  tagsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagChip:        { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  tagChipText:    { fontSize: 11, fontWeight: '600' },
  roleWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  roleChipText: { fontSize: 12, fontWeight: '700' },
  roleColorDot: { width: 8, height: 8, borderRadius: 4 },
  roleColorEditor: { gap: 9, marginBottom: 10 },
  roleColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  roleColorLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleColorName: { fontSize: 12, fontWeight: '800' },
  roleSwatches: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  roleSwatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  roleSwatchActive: {
    shadowColor: colors.purple,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  addRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addRoleInput: { flex: 1, fontSize: 13, paddingVertical: 4 },
  addRoleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  infoPulseTrack: { height: 7, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  infoPulseFill: { height: '100%', borderRadius: 4, backgroundColor: colors.purple },
  infoPulseFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoPulseText: { flex: 1, fontSize: 12, lineHeight: 17 },
  infoPulseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.purple,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoPulseBtnText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  infoMembersList: { gap: 8 },
  infoMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 9,
  },
  infoMemberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  infoMemberAvatarImage: { width: '100%', height: '100%' },
  infoMemberAvatarText: { fontSize: 11, fontWeight: '900' },
  infoMemberOnline: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2,
  },
  infoMemberBody: { flex: 1 },
  infoMemberName: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  infoMemberStatus: { fontSize: 11, fontWeight: '700' },
  infoMemberRole: {
    maxWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  infoMemberRoleText: { fontSize: 11, fontWeight: '900' },
  infoRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  infoRowIcon:    { width: 24 },
  infoRowLabel:   { flex: 1, fontSize: 13, fontWeight: '500' },
  infoRowValue:   { fontSize: 13, fontWeight: '600' },
  infoDivider:    { height: 1 },
  inviteLinkBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, marginBottom: 10,
  },
  inviteLinkText: { fontSize: 13, fontWeight: '700' },
  inviteSheet: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '76%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  inviteSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inviteSheetTitle: { fontSize: 17, fontWeight: '900' },
  inviteSheetSub: { fontSize: 12, marginTop: 3 },
  inviteSheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitePeopleList: { maxHeight: 330 },
  invitePersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    marginBottom: 8,
  },
  invitePersonAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  invitePersonAvatarImage: { width: '100%', height: '100%' },
  invitePersonAvatarText: { fontSize: 12, fontWeight: '900' },
  invitePersonBody: { flex: 1 },
  invitePersonName: { fontSize: 13.5, fontWeight: '900' },
  invitePersonMeta: { fontSize: 11.5, marginTop: 2 },
  inviteSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moderationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  moderationBtnText: { fontSize: 13, fontWeight: '800' },
  leaveBtn:       { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  leaveBtnText:   { fontSize: 13, fontWeight: '700', color: colors.red },
  archivedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, borderWidth: 1,
  },
  archivedBannerText: { fontSize: 13, fontWeight: '700' },

  // Inline leave confirmation
  confirmLeaveBox: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10, gap: 6 },
  confirmLeaveTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  confirmLeaveSub:   { fontSize: 12, textAlign: 'center', marginBottom: 4 },
  confirmLeaveRow:   { flexDirection: 'row', gap: 10 },
  confirmLeaveCancel:  { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 11, alignItems: 'center' },
  confirmLeaveCancelText: { fontSize: 13, fontWeight: '600' },
  confirmLeaveConfirm: { flex: 1, borderRadius: 12, backgroundColor: colors.red, paddingVertical: 11, alignItems: 'center' },
  confirmLeaveConfirmText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Member mini-profile sheet
  memberProfileSheet: {
    width: '92%',
    maxWidth: 360,
    maxHeight: '88%',
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    gap: 10,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  memberProfileScroll: {
    width: '100%',
  },
  memberProfileContent: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },
  memberProfileCloseIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberProfileHero: {
    width: 96,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  memberProfileAvRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  memberProfileAv: {
    width: '100%', height: '100%', borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  memberProfileAvImage: { width: '100%', height: '100%' },
  memberProfileAvText: { fontSize: 22, fontWeight: '900' },
  memberProfileName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: -2,
  },
  memberProfileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  memberProfileRoleBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberProfileRoleDot: { width: 8, height: 8, borderRadius: 4 },
  memberProfileRoleText: { fontSize: 12, fontWeight: '800' },
  memberProfileStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memberProfileStatusDot: { width: 6, height: 6, borderRadius: 3 },
  memberProfileStatusText: { fontSize: 11.5, fontWeight: '800' },
  memberProfileBio: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  memberInsightCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 6,
  },
  memberInsightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberInsightTitle: { fontSize: 12.5, fontWeight: '800' },
  memberInsightText: { fontSize: 12, lineHeight: 17 },
  memberMiniStats: { flexDirection: 'row', width: '100%', gap: 8 },
  memberMiniStat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
  },
  memberMiniStatValue: { fontSize: 16, fontWeight: '900' },
  memberMiniStatLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  memberTagsList: { width: '100%', gap: 7 },
  memberTagDetail: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  memberTagName: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  memberTagDesc: { fontSize: 11.5, lineHeight: 16 },
  followBtn: {
    width: '100%',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: colors.purple,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  followBtnText: { fontSize: 13, fontWeight: '800' },
  memberModerationRow: { flexDirection: 'row', width: '100%', gap: 8 },
  memberModerationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
  },
  memberModerationText: { fontSize: 12, fontWeight: '800' },
  kickBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 10,
    marginTop: 2,
  },

  // Blocked message placeholder
  blockedMsgWrap: {
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  blockedMsgBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  blockedMsgText: { fontSize: 12, fontStyle: 'italic' },

  memberProfileClose: { paddingHorizontal: 20, paddingVertical: 8 },
  memberProfileCloseText: { fontSize: 13, fontWeight: '600' },

  // Image viewer
  imageViewer: {
    flex: 1,
    backgroundColor: '#05050a',
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageViewerSafe: {
    flex: 1,
  },
  imageViewerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  imageViewerClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerActions: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    gap: 12,
  },
  imageViewerActionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  imageViewerSaveBtn: {
    backgroundColor: 'rgba(107,92,231,0.72)',
    borderColor: 'rgba(196,184,255,0.36)',
  },
  imageViewerActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },

  // Long-press menu
  menuBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menuSheet: {
    width: '100%', maxWidth: 340,
    borderRadius: 22, borderWidth: 1,
    overflow: 'hidden', paddingTop: 14, paddingBottom: 8,
  },
  menuPreview: {
    marginHorizontal: 14, marginBottom: 12,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  menuPreviewText: { fontSize: 13, lineHeight: 18 },
  menuReactions:   { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 14, paddingBottom: 12 },
  menuEmoji:       { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  menuEmojiText:   { fontSize: 24 },
  menuDivider:     { height: 1, marginBottom: 4 },
  menuAction:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  menuActionIcon:  { width: 26 },
  menuActionText:  { fontSize: 14, fontWeight: '500' },
});
