import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Image, Alert, Modal, Pressable,
  KeyboardAvoidingView, Platform, Animated, PanResponder, useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrimaryButton from '../components/PrimaryButton';
import RoomCard from '../components/RoomCard';
import TagChip from '../components/TagChip';
import { useApp } from '../context/AppContext';
import { languages, roomIconColors, roomIconOptions, ROOM_TYPES } from '../data/mockRooms';
import TagAccordion from '../components/TagAccordion';
import { colors, getPalette, radius, spacing } from '../theme';
import { t } from '../i18n';

const ROOM_TYPE_OPTIONS = [
  { key: 'project',    iconName: 'radio-button-on-outline', labelKey: 'createRoom.project',    descKey: 'createRoom.projectDesc' },
  { key: 'networking', iconName: 'chatbubbles-outline',     labelKey: 'createRoom.networking', descKey: 'createRoom.networkingDesc' },
  { key: 'learning',   iconName: 'book-outline',            labelKey: 'createRoom.learning',   descKey: 'createRoom.learningDesc' },
];

const PRIVACY_OPTIONS = [
  { key: 'public',  iconName: 'earth-outline', labelKey: 'createRoom.public',  descKey: 'createRoom.publicDesc' },
  { key: 'invite',  iconName: 'link-outline', labelKey: 'createRoom.invite',  descKey: 'createRoom.inviteDesc' },
  { key: 'private', iconName: 'lock-closed-outline', labelKey: 'createRoom.private', descKey: 'createRoom.privateDesc' },
];

const LANGUAGES        = languages;
const LIFETIME_OPTIONS = [7, 14, 30];
const PRIVACY_LABELS   = { public: 'createRoom.public', invite: 'createRoom.inviteOnly', private: 'createRoom.private' };
const PRIVACY_ICONS    = { public: 'earth-outline', invite: 'link-outline', private: 'lock-closed-outline' };
const ROLE_COLOR_PALETTE = ['#7C5CFC', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444'];

const defaultRoleColor = index => ROLE_COLOR_PALETTE[index % ROLE_COLOR_PALETTE.length];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeHexColor = value => {
  const clean = String(value || '').trim().replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(clean) ? `#${clean.toUpperCase()}` : null;
};
const hsvToHex = (h, s, v) => {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = value - chroma;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  return [r, g, b]
    .map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .replace(/^/, '#');
};
const hexToHsv = hex => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return {
    hue,
    saturation: max === 0 ? 0 : (delta / max) * 100,
    value: max * 100,
  };
};

export default function CreateRoomScreen({ navigation }) {
  const { createRoom, themeMode, premiumSettings } = useApp();
  const palette = getPalette(themeMode);
  const isDark  = palette.isDark;
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sheetSideInset = width >= 768 ? Math.max(24, (width - 640) / 2) : 0;
  const colorPickerSize = Math.min(238, Math.max(190, width - sheetSideInset * 2 - 128));

  const [roomType,     setRoomType]     = useState('project');
  const [checkinEnabled, setCheckinEnabled] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState('rocket-outline');
  const [imageUri,     setImageUri]     = useState(null);
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [privacy,      setPrivacy]      = useState('public');
  const [language,     setLanguage]     = useState('English');
  const [memberCount,  setMemberCount]  = useState(8);
  const [lifetime,     setLifetime]     = useState(14);

  const [roles,        setRoles]        = useState(['Member']);
  const [roleColors,   setRoleColors]   = useState({ Creator: defaultRoleColor(0), Member: defaultRoleColor(1) });
  const [roleInput,    setRoleInput]    = useState('');
  const [customColorRole, setCustomColorRole] = useState(null);
  const [customColorDraft, setCustomColorDraft] = useState(defaultRoleColor(0));
  const [pickerHue, setPickerHue] = useState(270);
  const [pickerSaturation, setPickerSaturation] = useState(74);
  const [pickerValue, setPickerValue] = useState(96);

  const addRole = () => {
    const trimmed = roleInput.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'creator') {
      Alert.alert(t('createRoom.roleReservedTitle'), t('createRoom.roleReservedMessage'));
      return;
    }
    if (roles.some(role => role.toLowerCase() === trimmed.toLowerCase())) return;
    setRoles(prev => [...prev, trimmed]);
    setRoleColors(prev => ({ ...prev, [trimmed]: defaultRoleColor(roles.length + 1) }));
    setRoleInput('');
  };
  const removeRole = (role) => {
    setRoles(prev => {
      if (prev.length <= 1) {
        Alert.alert(t('createRoom.keepRoleTitle'), t('createRoom.keepRoleMessage'));
        return prev;
      }
      return prev.filter(r => r !== role);
    });
    setRoleColors(prev => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
  };

  const changeRoleColor = (role, color) => {
    setRoleColors(prev => ({ ...prev, [role]: color }));
  };

  const openCustomRoleColor = (role, fallbackColor) => {
    const hsv = hexToHsv(fallbackColor);
    if (hsv) {
      setPickerHue(hsv.hue);
      setPickerSaturation(hsv.saturation);
      setPickerValue(hsv.value);
    }
    setCustomColorRole(role);
    setCustomColorDraft(fallbackColor || defaultRoleColor(0));
  };

  const applyCustomRoleColor = () => {
    const nextColor = normalizeHexColor(customColorDraft);
    if (!customColorRole || !nextColor) return;
    changeRoleColor(customColorRole, nextColor);
    setCustomColorRole(null);
  };

  const setColorFromSquare = event => {
    const x = clamp(event.nativeEvent.locationX, 0, colorPickerSize);
    const y = clamp(event.nativeEvent.locationY, 0, colorPickerSize);
    const nextSaturation = (x / colorPickerSize) * 100;
    const nextValue = 100 - (y / colorPickerSize) * 100;
    setPickerSaturation(nextSaturation);
    setPickerValue(nextValue);
    setCustomColorDraft(hsvToHex(pickerHue, nextSaturation, nextValue));
  };

  const setHueFromBar = event => {
    const y = clamp(event.nativeEvent.locationY, 0, colorPickerSize);
    const nextHue = (y / colorPickerSize) * 360;
    setPickerHue(nextHue);
    setCustomColorDraft(hsvToHex(nextHue, pickerSaturation, pickerValue));
  };

  const handleCustomHexChange = value => {
    setCustomColorDraft(value);
    const hsv = hexToHsv(value);
    if (hsv) {
      setPickerHue(hsv.hue);
      setPickerSaturation(hsv.saturation);
      setPickerValue(hsv.value);
    }
  };

  const [showLangPicker,    setShowLangPicker]    = useState(false);
  const [showPreview,       setShowPreview]       = useState(false);

  const [nameTouched, setNameTouched] = useState(false);
  const [descTouched, setDescTouched] = useState(false);

  // ── Swipe-to-dismiss sheet ──────────────────────────────────────────────────
  const sheetY = useRef(new Animated.Value(0)).current;

  const closeSheet = () => {
    Animated.timing(sheetY, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      sheetY.setValue(0);
      navigation.goBack();
    });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => { sheetY.setValue(Math.max(0, g.dy)); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.9) { closeSheet(); return; }
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
  }), [sheetY]);

  const nameTrimmed  = name.trim();
  const descTrimmed  = description.trim();
  const nameError    = nameTouched && nameTrimmed.length < 4 ? t('createRoom.useName') : null;
  const descError    = descTouched && descTrimmed.length < 12 ? t('createRoom.useDescription') : null;
  const canCreate    = nameTrimmed.length >= 4 && descTrimmed.length >= 12 && roles.length > 0;

  // With transparentModal presentation the backdrop visually covers the tab bar — no need to hide it

  const toggleTag = (tag) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('createRoom.galleryTitle'), t('createRoom.galleryMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) setImageUri(result.assets[0].uri);
  };

  const handlePreview = () => {
    setNameTouched(true);
    setDescTouched(true);
    if (!canCreate) {
      Alert.alert(t('createRoom.almostReadyTitle'), t('createRoom.almostReadyMessage'));
      return;
    }
    setShowPreview(true);
  };

  const handleCreate = () => {
    setShowPreview(false);
    if (!canCreate) return;
    const room = createRoom({
      icon: selectedIcon,
      imageUri,
      iconBg: roomIconColors[selectedIcon] || '#ede9ff',
      cardBg: premiumSettings?.roomCardBg || null,
      name: nameTrimmed,
      description: descTrimmed,
      tags: selectedTags,
      privacy,
      language,
      maxMembers: memberCount,
      lifetime,
      type: roomType,
      checkinEnabled,
      roles,
      roleColors: {
        Creator: roleColors.Creator || defaultRoleColor(0),
        ...roles.reduce((acc, role, index) => {
          acc[role] = roleColors[role] || defaultRoleColor(index + 1);
          return acc;
        }, {}),
      },
    });
    navigation.replace('Room', { roomId: room.id });
  };

  return (
    <View style={styles.root}>
      {/* Dim backdrop — tapping dismisses */}
      <Pressable style={styles.backdrop} onPress={closeSheet} />

      {/* Glass bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            left: sheetSideInset,
            right: sheetSideInset,
            backgroundColor: isDark ? 'rgba(26,22,48,0.78)' : 'rgba(242,239,255,0.76)',
            borderColor:     isDark ? 'rgba(255,255,255,0.16)' : 'rgba(107,92,231,0.22)',
            shadowColor:     isDark ? '#000' : colors.purple,
            transform: [{ translateY: sheetY }],
          },
        ]}
      >
        <BlurView
          intensity={isDark ? 55 : 80}
          tint={isDark ? 'dark' : 'extraLight'}
          style={StyleSheet.absoluteFill}
        />

        {/* Drag handle */}
        <TouchableOpacity
          style={styles.handleHitbox}
          onPress={closeSheet}
          activeOpacity={0.75}
          {...panResponder.panHandlers}
        >
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.68)' : '#d8d4e8' }]} />
        </TouchableOpacity>

        {/* Sheet header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>{t('createRoom.title')}</Text>
            <Text style={[styles.sheetSubtitle, { color: palette.faint }]}>{t('createRoom.subtitle')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
            onPress={closeSheet}
          >
            <Ionicons name="close" size={18} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 34, 54) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            alwaysBounceVertical
            nestedScrollEnabled
          >

            {/* ── Room type ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.roomType')}</Text>
                <Text style={[styles.required, { color: isDark ? '#c4b8ff' : colors.purple, backgroundColor: palette.glass.purpleBg }]}>{t('createRoom.required')}</Text>
              </View>
              <View style={styles.typeRow}>
                {ROOM_TYPE_OPTIONS.map(option => {
                  const active = roomType === option.key;
                  const typeColor = ROOM_TYPES[option.key].color;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.typeCard,
                        { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                        active && { borderColor: typeColor, backgroundColor: typeColor + '15' },
                      ]}
                      onPress={() => setRoomType(option.key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={option.iconName} size={24} color={active ? typeColor : palette.muted} style={styles.typeCardIcon} />
                      <Text style={[styles.typeCardLabel, { color: active ? typeColor : palette.text }]}>{t(option.labelKey)}</Text>
                      <Text style={[styles.typeCardDesc, { color: palette.faint }]}>{t(option.descKey)}</Text>
                      {active && (
                        <View style={[styles.typeCardCheck, { backgroundColor: typeColor }]}>
                          <Ionicons name="checkmark" size={12} color={colors.white} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Check-in toggle for Learning */}
              {roomType === 'learning' && (
                <TouchableOpacity
                  style={[styles.checkinToggle, { backgroundColor: palette.glass.bgMedium, borderColor: checkinEnabled ? ROOM_TYPES.learning.color : palette.glass.border }]}
                  onPress={() => setCheckinEnabled(p => !p)}
                  activeOpacity={0.8}
                >
                  <View style={styles.checkinToggleLeft}>
                    <Text style={[styles.checkinToggleTitle, { color: palette.text }]}>{t('createRoom.dailyCheckIn')}</Text>
                    <Text style={[styles.checkinToggleSub, { color: palette.muted }]}>{t('createRoom.dailyCheckInSub')}</Text>
                  </View>
                  <View style={[styles.toggleTrack, { backgroundColor: checkinEnabled ? ROOM_TYPES.learning.color : palette.glass.bgStrong }]}>
                    <View style={[styles.toggleThumb, checkinEnabled && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Icon ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.roomIcon')}</Text>
              <View style={styles.iconRow}>
                <View style={[styles.iconPreview, { backgroundColor: roomIconColors[selectedIcon] || colors.purple }]}>
                  {imageUri
                    ? <Image source={{ uri: imageUri }} style={styles.iconPreviewImage} />
                    : <Ionicons name={selectedIcon.replace('-outline', '')} size={36} color="rgba(255,255,255,0.95)" />}
                </View>
                <View style={styles.iconSide}>
                  <View style={styles.iconGrid}>
                    {roomIconOptions.map(iconName => {
                      const isActive = selectedIcon === iconName && !imageUri;
                      const iconColor = roomIconColors[iconName] || colors.purple;
                      return (
                        <TouchableOpacity
                          key={iconName}
                          style={[
                            styles.iconOption,
                            { backgroundColor: isActive ? iconColor : palette.glass.bgMedium },
                            isActive && styles.iconOptionActive,
                          ]}
                          onPress={() => { setSelectedIcon(iconName); setImageUri(null); }}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name={iconName.replace('-outline', '')}
                            size={20}
                            color={isActive ? 'rgba(255,255,255,0.95)' : palette.muted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity style={[styles.galleryBtn, { borderColor: palette.glass.purpleBorder }]} onPress={pickImage}>
                    <Ionicons name="image-outline" size={17} color={colors.purple} />
                    <Text style={styles.galleryText}>{imageUri ? t('createRoom.changeGallery') : t('createRoom.chooseGallery')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Name ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: nameError ? colors.red : palette.glass.border }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.roomName')}</Text>
                <Text style={[styles.required, { color: isDark ? '#c4b8ff' : colors.purple, backgroundColor: palette.glass.purpleBg }]}>{t('createRoom.required')}</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: palette.glass.bgMedium, color: palette.text }, nameError && styles.inputError]}
                placeholder={t('createRoom.roomNamePlaceholder')}
                placeholderTextColor={palette.faint}
                value={name}
                onChangeText={setName}
                onBlur={() => setNameTouched(true)}
                maxLength={60}
              />
              <View style={styles.fieldFooter}>
                {nameError ? <Text style={styles.errorText}>! {nameError}</Text> : <View />}
                <Text style={[styles.charCount, { color: palette.faint }]}>{name.length}/60</Text>
              </View>
            </View>

            {/* ── Goal ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: descError ? colors.red : palette.glass.border }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.goal')}</Text>
                <Text style={[styles.required, { color: isDark ? '#c4b8ff' : colors.purple, backgroundColor: palette.glass.purpleBg }]}>{t('createRoom.required')}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputMultiline, { backgroundColor: palette.glass.bgMedium, color: palette.text }, descError && styles.inputError]}
                placeholder={t('createRoom.goalPlaceholder')}
                placeholderTextColor={palette.faint}
                value={description}
                onChangeText={setDescription}
                onBlur={() => setDescTouched(true)}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
              />
              <View style={styles.fieldFooter}>
                {descError ? <Text style={styles.errorText}>! {descError}</Text> : <View />}
                <Text style={[styles.charCount, { color: palette.faint }]}>{description.length}/200</Text>
              </View>
            </View>

            {/* ── Tags ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.tags')}</Text>
                {selectedTags.length > 0 && (
                  <View style={[styles.tagCountBadge, { backgroundColor: palette.glass.purpleBg }]}>
                    <Text style={[styles.tagCountText, { color: isDark ? '#c4b8ff' : colors.purple }]}>
                      {selectedTags.length} {t('createRoom.selected')}
                    </Text>
                  </View>
                )}
              </View>
              <TagAccordion
                selectedTags={selectedTags}
                onToggle={toggleTag}
                palette={palette}
                isDark={isDark}
              />
            </View>

            {/* ── Roles ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.teamRoles')}</Text>
                <View style={[styles.tagCountBadge, { backgroundColor: palette.glass.purpleBg }]}>
                  <Text style={[styles.tagCountText, { color: isDark ? '#c4b8ff' : colors.purple }]}>
                    {roles.length + 1} {t('createRoom.roles')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.rolesHint, { color: palette.faint }]}>
                {t('createRoom.rolesHint')}
              </Text>
              {/* Existing roles */}
              <View style={styles.roleList}>
                {['Creator', ...roles].map((role, index) => {
                  const selectedColor = roleColors[role] || defaultRoleColor(index);
                  const locked = role === 'Creator';
                  return (
                    <View
                      key={role}
                      style={[styles.roleEditorRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}
                    >
                      <View style={styles.roleEditorTop}>
                        <View style={styles.roleNameRow}>
                          <View style={[styles.roleColorDot, { backgroundColor: selectedColor }]} />
                          <Text style={[styles.roleChipText, { color: locked ? (isDark ? '#c4b8ff' : colors.purple) : palette.text }]}>
                            {locked ? `* ${t('createRoom.creator')}` : role}
                          </Text>
                        </View>
                        {!locked && (
                          <TouchableOpacity onPress={() => removeRole(role)} hitSlop={8} activeOpacity={0.75}>
                            <Ionicons name="close" size={15} color={palette.faint} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.roleSwatches}>
                        {ROLE_COLOR_PALETTE.map(color => (
                          <TouchableOpacity
                            key={`${role}-${color}`}
                            style={[
                              styles.roleSwatch,
                              { backgroundColor: color },
                              selectedColor === color && styles.roleSwatchActive,
                            ]}
                            onPress={() => changeRoleColor(role, color)}
                            activeOpacity={0.78}
                          />
                        ))}
                        <TouchableOpacity
                          style={[
                            styles.roleCustomSwatch,
                            { borderColor: selectedColor, backgroundColor: palette.glass.bgStrong },
                          ]}
                          onPress={() => openCustomRoleColor(role, selectedColor)}
                          activeOpacity={0.78}
                        >
                          <Ionicons name="color-palette-outline" size={15} color={selectedColor} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
              {/* Add role input */}
              <View style={[styles.addRoleRow, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
                <TextInput
                  style={[styles.addRoleInput, { color: palette.text }]}
                  value={roleInput}
                  onChangeText={setRoleInput}
                  placeholder={t('createRoom.rolePlaceholder')}
                  placeholderTextColor={palette.faint}
                  maxLength={22}
                  returnKeyType="done"
                  onSubmitEditing={addRole}
                />
                <TouchableOpacity
                  style={[styles.addRoleBtn, { backgroundColor: roleInput.trim() ? colors.purple : palette.glass.bgStrong }]}
                  onPress={addRole}
                  disabled={!roleInput.trim()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color={roleInput.trim() ? colors.white : palette.faint} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Privacy ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.privacy')}</Text>
              <View style={styles.privacyRow}>
                {PRIVACY_OPTIONS.map(option => {
                  const active = privacy === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.privacyCard,
                        { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border },
                        active && { borderColor: colors.purple, backgroundColor: palette.glass.purpleBg },
                      ]}
                      onPress={() => setPrivacy(option.key)}
                    >
                      <Ionicons
                        name={option.iconName}
                        size={23}
                        color={active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted}
                        style={styles.privacyIcon}
                      />
                      <Text style={[styles.privacyLabel, { color: palette.muted }, active && { color: isDark ? '#c4b8ff' : colors.purple }]}>{t(option.labelKey)}</Text>
                      <Text style={[styles.privacyDesc, { color: palette.faint }]}>{t(option.descKey)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Language ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.language')}</Text>
              <TouchableOpacity
                style={[styles.dropdownTrigger, { backgroundColor: palette.glass.bgMedium }, showLangPicker && { borderColor: colors.purple, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
                onPress={() => setShowLangPicker(p => !p)}
              >
                <View style={styles.dropdownValueRow}>
                  <Ionicons name="language-outline" size={16} color={palette.muted} />
                  <Text style={[styles.dropdownValue, { color: palette.text }]}>{language}</Text>
                </View>
                <Ionicons name={showLangPicker ? 'chevron-up' : 'chevron-down'} size={17} color={palette.faint} />
              </TouchableOpacity>
              {showLangPicker && (
                <View style={[styles.dropdown, { borderColor: colors.purple }]}>
                  {LANGUAGES.map(lang => {
                    const active = language === lang;
                    return (
                      <TouchableOpacity
                        key={lang}
                        style={[styles.dropdownOption, { backgroundColor: palette.glass.bgMedium }, active && { backgroundColor: palette.glass.purpleBg }]}
                        onPress={() => { setLanguage(lang); setShowLangPicker(false); }}
                      >
                        <Text style={[styles.dropdownOptionText, { color: palette.text }, active && { color: isDark ? '#c4b8ff' : colors.purple, fontWeight: '700' }]}>{lang}</Text>
                        {active && <Text style={styles.dropdownCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ── Members limit ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.labelRow}>
                <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.membersLimit')}</Text>
                <View style={[styles.memberBadge, { backgroundColor: palette.glass.purpleBg }]}>
                  <Text style={[styles.memberBadgeText, { color: isDark ? '#c4b8ff' : colors.purple }]}>{memberCount} {t('createRoom.people')}</Text>
                </View>
              </View>
              {/* Track slider */}
              {(() => {
                const MIN = 3, MAX = 15;
                const pct = ((memberCount - MIN) / (MAX - MIN)) * 100;
                return (
                  <View style={styles.sliderWrap}>
                    {/* Track background */}
                    <View style={[styles.sliderTrack, { backgroundColor: palette.glass.bgStrong }]}>
                      {/* Filled part */}
                      <View style={[styles.sliderFill, { width: `${pct}%`, backgroundColor: colors.purple }]} />
                      {/* Thumb */}
                      <View style={[styles.sliderThumb, { left: `${pct}%`, backgroundColor: colors.white, borderColor: colors.purple }]} />
                    </View>
                    {/* Tap zones — invisible, one per step */}
                    <View style={styles.sliderTapRow}>
                      {Array.from({ length: MAX - MIN + 1 }, (_, i) => i + MIN).map(n => (
                        <TouchableOpacity key={n} style={styles.sliderTapZone} onPress={() => setMemberCount(n)} activeOpacity={1} />
                      ))}
                    </View>
                    <View style={styles.trackLabels}>
                      <Text style={[styles.trackLabelText, { color: palette.faint }]}>{MIN}</Text>
                      <Text style={[styles.trackLabelText, { color: palette.faint }]}>{MAX}</Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* ── Lifetime ── */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <Text style={[styles.sectionLabel, { color: palette.text }]}>{t('createRoom.roomLifetime')}</Text>
              <View style={styles.lifetimeRow}>
                {LIFETIME_OPTIONS.map(days => {
                  const active = lifetime === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.lifetimeChip,
                        { borderColor: palette.glass.border, backgroundColor: palette.glass.bgMedium },
                        active && { borderColor: colors.purple, backgroundColor: palette.glass.purpleBg },
                      ]}
                      onPress={() => setLifetime(days)}
                    >
                      <Text style={[styles.lifetimeDays, { color: palette.faint }, active && { color: isDark ? '#c4b8ff' : colors.purple }]}>{days}</Text>
                      <Text style={[styles.lifetimeUnit, { color: palette.faint }, active && { color: isDark ? '#c4b8ff' : colors.purple }]}>{t('createRoom.days')}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.lifetimeHintRow}>
                <Ionicons name="time-outline" size={14} color={palette.faint} />
                <Text style={[styles.lifetimeHint, { color: palette.faint }]}>{t('createRoom.lifetimeHint')}</Text>
              </View>
            </View>

            <PrimaryButton
              label={t('createRoom.previewCreate')}
              disabled={!canCreate}
              onPress={handlePreview}
              style={styles.createBtn}
            />

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Preview Modal ── */}
        <Modal visible={!!customColorRole} transparent animationType="fade" onRequestClose={() => setCustomColorRole(null)}>
          <Pressable style={styles.colorModalBackdrop} onPress={() => setCustomColorRole(null)} />
          <View style={styles.colorModalWrap}>
            <View style={[styles.colorModal, { backgroundColor: isDark ? 'rgba(26,22,48,0.96)' : 'rgba(255,255,255,0.96)', borderColor: palette.glass.border }]}>
              <View style={styles.colorModalHeader}>
                <View>
                  <Text style={[styles.colorModalTitle, { color: palette.text }]}>Role color</Text>
                  <Text style={[styles.colorModalSub, { color: palette.faint }]}>{customColorRole}</Text>
                </View>
                <View style={[styles.colorPreview, { backgroundColor: normalizeHexColor(customColorDraft) || roleColors[customColorRole] || colors.purple }]} />
              </View>
              <View style={[styles.hexInputRow, { backgroundColor: palette.glass.bgMedium, borderColor: normalizeHexColor(customColorDraft) ? palette.glass.border : colors.red + '70' }]}>
                <Text style={[styles.hexPrefix, { color: palette.faint }]}>HEX</Text>
                <TextInput
                  style={[styles.hexInput, { color: palette.text }]}
                  value={customColorDraft}
                  onChangeText={handleCustomHexChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                  placeholder="#7C5CFC"
                  placeholderTextColor={palette.faint}
                />
              </View>
              <View style={styles.colorPickerRow}>
                <View
                  style={[
                    styles.colorSquare,
                    {
                      width: colorPickerSize,
                      height: colorPickerSize,
                      backgroundColor: hsvToHex(pickerHue, 100, 100),
                    },
                  ]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={setColorFromSquare}
                  onResponderMove={setColorFromSquare}
                >
                  <LinearGradient
                    colors={['#FFFFFF', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', '#000000']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.colorSelector,
                      {
                        left: `${pickerSaturation}%`,
                        top: `${100 - pickerValue}%`,
                      },
                    ]}
                  />
                </View>
                <View
                  style={[styles.hueBar, { height: colorPickerSize }]}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={setHueFromBar}
                  onResponderMove={setHueFromBar}
                >
                  <LinearGradient
                    colors={['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    pointerEvents="none"
                    style={[
                      styles.hueSelector,
                      { top: `${pickerHue / 3.6}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.colorModalActions}>
                <TouchableOpacity
                  style={[styles.colorCancelBtn, { borderColor: palette.glass.border }]}
                  onPress={() => setCustomColorRole(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.colorCancelText, { color: palette.muted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.colorApplyBtn, !normalizeHexColor(customColorDraft) && styles.colorApplyBtnDisabled]}
                  onPress={applyCustomRoleColor}
                  disabled={!normalizeHexColor(customColorDraft)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.colorApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showPreview} transparent animationType="slide" onRequestClose={() => setShowPreview(false)}>
          <Pressable style={styles.backdrop} onPress={() => setShowPreview(false)} />
          <View style={[styles.previewSheet, { backgroundColor: isDark ? '#1a1630' : colors.white, marginHorizontal: sheetSideInset }]}>
            <TouchableOpacity style={styles.sheetHandleHitbox} onPress={() => setShowPreview(false)} activeOpacity={0.75}>
              <View style={[styles.sheetHandle, { backgroundColor: palette.glass.borderStrong }]} />
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: palette.text }]}>{t('createRoom.preview')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>

            {/* Real RoomCard — exactly as it appears on home screen */}
            <RoomCard
              room={{
                id: '__preview__',
                icon: selectedIcon,
                imageUri: imageUri || null,
                iconBg: roomIconColors[selectedIcon] || '#ede9ff',
                cardBg: premiumSettings?.roomCardBg || null,
                title: name || t('createRoom.roomName'),
                desc: description || t('createRoom.goalPlaceholder'),
                tags: selectedTags.length > 0 ? selectedTags : [t('createRoom.general')],
                language,
                membersCount: 1,
                maxMembers: memberCount,
                online: 0,
                daysLeft: lifetime,
                lifetime,
                pulseGoal: 1,
                pulseCount: 0,
                isMember: true,
                isMine: true,
                isSaved: false,
                type: roomType,
                privacy,
                time: 'Just now',
                unread: 0,
              }}
              mode="feed"
              onPress={() => {}}
            />

            {/* Details grid */}
            <View style={[styles.detailsGrid, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              {[
                { iconName: ROOM_TYPE_OPTIONS.find(item => item.key === roomType)?.iconName || 'radio-button-on-outline', label: t('createRoom.roomType'), value: t(ROOM_TYPE_OPTIONS.find(item => item.key === roomType)?.labelKey || 'createRoom.project') },
                { iconName: PRIVACY_ICONS[privacy], label: t('createRoom.privacy'),  value: t(PRIVACY_LABELS[privacy]) },
                { iconName: 'people-outline', label: t('createRoom.membersLimit'),  value: `${t('createRoom.upTo')} ${memberCount}` },
                { iconName: 'time-outline', label: t('createRoom.roomLifetime'), value: `${lifetime} ${t('createRoom.days')}` },
                { iconName: 'language-outline', label: t('createRoom.language'), value: language },
                { iconName: 'people-circle-outline', label: t('createRoom.teamRoles'), value: [t('createRoom.creator'), ...roles].join(', ') },
                { iconName: 'pricetag-outline', label: t('createRoom.tags'), value: selectedTags.length > 0 ? selectedTags.join(', ') : t('createRoom.general') },
              ].map((row, i, arr) => (
                <View key={row.label}>
                  <View style={styles.detailRow}>
                    <Ionicons name={row.iconName} size={17} color={isDark ? '#c4b8ff' : colors.purple} style={styles.detailIcon} />
                    <Text style={[styles.detailLabel, { color: palette.muted }]}>{row.label}</Text>
                    <Text style={[styles.detailValue, { color: palette.text }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[styles.detailDivider, { backgroundColor: palette.glass.border }]} />}
                </View>
              ))}
            </View>

            </ScrollView>

            {/* Actions — fixed at bottom */}
            <View style={[styles.previewActions, { borderTopColor: palette.glass.border }]}>
              <TouchableOpacity style={[styles.editBtn, { borderColor: palette.glass.border }]} onPress={() => setShowPreview(false)}>
                <Text style={[styles.editBtnText, { color: palette.muted }]}>{t('createRoom.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate}>
                <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                <Text style={styles.confirmBtnText}>{t('createRoom.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  handleHitbox: { alignSelf: 'center', paddingHorizontal: 44, paddingTop: 10, paddingBottom: 6 },
  handle: { width: 38, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  section: {
    marginHorizontal: spacing.screen,
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  required: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },

  // Icon picker
  iconRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  iconPreview: { width: 78, height: 78, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  iconPreviewImage: { width: '100%', height: '100%' },
  iconSide: { flex: 1, gap: 10 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconOptionActive: { borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.7)' },
  iconOptionText: { fontSize: 20 },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 10 },
  galleryText: { fontSize: 12, fontWeight: '700', color: colors.purple },

  // Inputs
  input: { borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, borderWidth: 1, borderColor: 'transparent' },
  inputMultiline: { minHeight: 88, paddingTop: 11, textAlignVertical: 'top' },
  inputError: { borderColor: colors.red + '60' },
  fieldFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  errorText: { fontSize: 11, color: colors.red, fontWeight: '500' },
  charCount: { fontSize: 10 },

  // Tags
  tagCountBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagCountText:  { fontSize: 11, fontWeight: '700' },

  // Room type
  typeRow: { flexDirection: 'row', gap: 8 },
  typeCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5,
    padding: 10, alignItems: 'center', position: 'relative',
  },
  typeCardIcon:  { marginBottom: 5 },
  typeCardLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  typeCardDesc:  { fontSize: 9.5, textAlign: 'center', lineHeight: 13 },
  typeCardCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  typeCardCheckText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  checkinToggle: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 14,
    padding: 12, marginTop: 10, gap: 10,
  },
  checkinToggleLeft: { flex: 1 },
  checkinToggleTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  checkinToggleSub:   { fontSize: 11, lineHeight: 15 },
  toggleTrack: {
    width: 42, height: 24, borderRadius: 12,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleThumb: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff', opacity: 0.6,
  },
  toggleThumbOn: { opacity: 1, alignSelf: 'flex-end' },

  // Roles
  rolesHint: { fontSize: 11, marginBottom: 10, lineHeight: 16 },
  roleList: { gap: 8, marginBottom: 10 },
  roleEditorRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 9,
  },
  roleEditorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  roleColorDot: { width: 10, height: 10, borderRadius: 5 },
  roleSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  roleSwatchActive: {
    borderColor: '#fff',
    shadowColor: colors.purple,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  roleCustomSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  roleChipText: { fontSize: 12, fontWeight: '700' },
  roleRemove: { fontSize: 11, lineHeight: 14 },
  addRoleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  addRoleInput: { flex: 1, fontSize: 13, paddingVertical: 4 },
  addRoleBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  colorModalWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  colorModal: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  colorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorModalTitle: { fontSize: 17, fontWeight: '800' },
  colorModalSub: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  colorPreview: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
    marginBottom: 14,
  },
  colorSquare: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  colorSelector: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -9,
    marginTop: -9,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 6,
  },
  hueBar: {
    width: 24,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  hueSelector: {
    position: 'absolute',
    left: -4,
    right: -4,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginTop: -4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  hexPrefix: { fontSize: 11, fontWeight: '800', marginRight: 10 },
  hexInput: { flex: 1, paddingVertical: 12, fontSize: 14, fontWeight: '700' },
  colorModalActions: { flexDirection: 'row', gap: 10 },
  colorCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  colorCancelText: { fontSize: 13, fontWeight: '800' },
  colorApplyBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.purple,
  },
  colorApplyBtnDisabled: { opacity: 0.45 },
  colorApplyText: { color: colors.white, fontSize: 13, fontWeight: '800' },

  // Privacy
  privacyRow: { flexDirection: 'row', gap: 8 },
  privacyCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 10, alignItems: 'center' },
  privacyIcon: { marginBottom: 5 },
  privacyLabel: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  privacyDesc: { fontSize: 9.5, textAlign: 'center' },

  // Dropdowns
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'transparent' },
  dropdownValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dropdownValue: { fontSize: 13, fontWeight: '500' },
  dropdown: { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, overflow: 'hidden' },
  dropdownOption: { paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between' },
  dropdownOptionText: { fontSize: 13 },
  dropdownCheck: { fontSize: 13, color: colors.purple, fontWeight: '700' },

  // Members slider
  memberBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  memberBadgeText: { fontSize: 11, fontWeight: '700' },
  sliderWrap: { marginTop: 10, marginBottom: 4 },
  sliderTrack: { height: 6, borderRadius: 3, position: 'relative', marginBottom: 18 },
  sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  sliderThumb: {
    position: 'absolute',
    width: 22, height: 22,
    borderRadius: 11,
    borderWidth: 3,
    marginLeft: -11,
    top: -8,
    shadowColor: colors.purple,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sliderTapRow: { position: 'absolute', left: 0, right: 0, top: -8, height: 28, flexDirection: 'row' },
  sliderTapZone: { flex: 1 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  trackLabelText: { fontSize: 10 },

  // Lifetime
  lifetimeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  lifetimeChip: { flex: 1, borderRadius: 14, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  lifetimeDays: { fontSize: 24, fontWeight: '800' },
  lifetimeUnit: { fontSize: 11, fontWeight: '500' },
  lifetimeHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  lifetimeHint: { fontSize: 11, textAlign: 'center' },

  createBtn: { marginHorizontal: spacing.screen, marginTop: 22 },
  bottomSpacer: { height: 18 },

  // Preview modal
  previewSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 16, maxHeight: '90%' },
  previewScroll: { paddingBottom: 16 },
  sheetHandleHitbox: { alignSelf: 'center', paddingHorizontal: 44, paddingTop: 2, paddingBottom: 12 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2 },
  previewTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  previewCard: { flexDirection: 'row', borderRadius: radius.lg, borderWidth: 1, padding: 13, gap: 12, marginBottom: 14 },
  previewCardIcon: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  previewCardIconImg: { width: '100%', height: '100%', borderRadius: 16 },
  previewCardBody: { flex: 1 },
  previewCardName: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  previewCardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 7 },
  previewTagsRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 5, overflow: 'hidden', alignItems: 'center' },
  previewTag: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  previewTagText: { fontSize: 10, fontWeight: '600' },
  detailsGrid: { borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  detailIcon: { width: 22 },
  detailLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  detailValue: { fontSize: 13, fontWeight: '600' },
  detailDivider: { height: 1 },
  previewActions: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1 },
  editBtn: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '600' },
  confirmBtn: { flex: 2, backgroundColor: colors.purple, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
