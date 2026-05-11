import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import ScreenHeader from '../components/ScreenHeader';
import { colors, getPalette, radius } from '../theme';
import TagAccordion, { CATEGORY_COLORS } from '../components/TagAccordion';
import { TAG_CATEGORIES } from '../data/mockRooms';
import { t } from '../i18n';

const toTagId = (name) => name.toLowerCase().replace(/[\s/]+/g, '-');

const getWords = (value = '') =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 2);

export default function EditProfileScreen({ navigation }) {
  const { profile, updateProfile, profileTags, updateProfileTags, deleteAccount, themeMode } = useApp();
  const palette = getPalette(themeMode);
  const isDark  = palette.isDark;

  const [avatarUri,    setAvatarUri]    = useState(profile.avatarUri ?? null);
  const [name,         setName]         = useState(profile.name);
  const [bio,          setBio]          = useState(profile.bio);
  const [location,     setLocation]     = useState(profile.location);
  const [selectedTags, setSelectedTags] = useState(profileTags);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profile.galleryAccess'), t('profile.galleryAccessDesc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  // selectedTags stores interest objects for ProfileScreen and recommendations.
  const selectedTagNames = [...new Set(selectedTags.flatMap(t => [t.name, ...(t.focusTags || [])]))];

  const handleToggleTag = (tagName) => {
    const cat  = TAG_CATEGORIES.find(c => c.tags.includes(tagName));
    const color = cat ? (CATEGORY_COLORS[cat.key] || colors.purple) : colors.purple;

    if (cat) {
      setSelectedTags(prev => {
        const existing = prev.find(t => t.id === cat.key || t.name === cat.label);
        if (existing) {
          const currentFocus = existing.focusTags || [];
          const nextFocus = currentFocus.includes(tagName)
            ? currentFocus.filter(item => item !== tagName)
            : [...currentFocus, tagName];
          if (nextFocus.length === 0 && !existing.desc) {
            return prev.filter(t => t.id !== existing.id && t.name !== cat.label);
          }
          return prev.map(t =>
            (t.id === existing.id || t.name === cat.label)
              ? { ...t, id: cat.key, name: cat.label, color, focusTags: nextFocus }
              : t
          );
        }
        return [
          ...prev,
          {
            id: cat.key,
            name: cat.label,
            color,
            desc: '',
            focusTags: [tagName],
          },
        ];
      });
      return;
    }

    const id = toTagId(tagName);
    setSelectedTags(prev => {
      if (prev.some(t => t.id === id || t.name === tagName)) {
        return prev.filter(t => t.id !== id && t.name !== tagName);
      }
      return [...prev, { id, name: tagName, color: colors.purple, desc: '', focusTags: [] }];
    });
  };

  const updateTagDesc = (id, desc) =>
    setSelectedTags(prev => prev.map(tag => tag.id === id ? { ...tag, desc } : tag));

  const removeTag = (id) => setSelectedTags(prev => {
    const target = prev.find(tag => tag.id === id);
    return prev.filter(tag => tag.id !== id && (!target || tag.name !== target.name));
  });

  const handleSave = () => {
    updateProfile({ name: name.trim() || profile.name, bio: bio.trim(), location: location.trim(), avatarUri });
    updateProfileTags(selectedTags.map(tag => ({
      ...tag,
      keywords: [...new Set([
        ...getWords(tag.name),
        ...getWords(tag.desc),
        ...(tag.focusTags || []).map(item => item.toLowerCase()),
      ])],
    })));
    Alert.alert(t('profile.savedTitle'), t('profile.savedDesc'));
    navigation.goBack();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountDesc'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteAccount().catch(() => {});
            navigation.getParent()?.goBack?.();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScreenHeader
            title={t('profile.editTitle')}
            onBack={() => navigation.goBack()}
            right={
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{t('profile.save')}</Text>
              </TouchableOpacity>
            }
          />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >

            {/* Avatar */}
            <View style={styles.avatarSection}>
              <TouchableOpacity style={styles.avWrap} onPress={pickAvatar} activeOpacity={0.8}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avImage} />
                ) : (
                  <View style={styles.av}>
                    <Text style={styles.avText}>{name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.avEditBtn}>
                  <Ionicons name="camera-outline" size={14} color={colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.changePhotoText}>{t('profile.changePhoto')}</Text>
            </View>

            {/* Basic info */}
            <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: palette.faint }]}>{t('profile.name')}</Text>
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('profile.yourName')}
                  placeholderTextColor={palette.faint}
                  autoCapitalize="words"
                  maxLength={24}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: palette.glass.border }]} />
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: palette.faint }]}>{t('profile.location')}</Text>
                <TextInput
                  style={[styles.input, { color: palette.text }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder={t('profile.locationPlaceholder')}
                  placeholderTextColor={palette.faint}
                  maxLength={40}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: palette.glass.border }]} />
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: palette.faint }]}>{t('profile.bio')}</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti, { color: palette.text }]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder={t('profile.bioPlaceholder')}
                  placeholderTextColor={palette.faint}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={150}
                />
                <Text style={[styles.charCount, { color: palette.faint }]}>{bio.length}/150</Text>
              </View>
            </View>

            {/* Interests */}
            <View style={[styles.section, styles.tagsSection, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.tagsTitleRow}>
                <Ionicons name="pricetag-outline" size={16} color={isDark ? '#c4b8ff' : colors.purple} />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.myInterests')}</Text>
                {selectedTags.length > 0 && (
                  <View style={[styles.tagCountBadge, { backgroundColor: palette.glass.purpleBg }]}>
                    <Text style={[styles.tagCountText, { color: isDark ? '#c4b8ff' : colors.purple }]}>
                      {selectedTags.length}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.sectionHint, { color: palette.faint }]}>{t('profile.interestsHint')}</Text>
              <TagAccordion
                selectedTags={selectedTagNames}
                onToggle={handleToggleTag}
                palette={palette}
                isDark={isDark}
              />
            </View>

            {/* Tag descriptions — only shown when tags are selected */}
            {selectedTags.length > 0 && (
            <View style={[styles.section, styles.tagsSection, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('profile.tagDescriptions')}</Text>
              <Text style={[styles.sectionHint, { color: palette.faint }]}>{t('profile.tagDescriptionsHint')}</Text>
              {selectedTags.map(tag => (
                <View key={tag.id} style={[styles.tagEditor, { borderColor: palette.glass.border }]}>
                  <View style={styles.tagEditorHeader}>
                    <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                    <Text style={[styles.tagEditorTitle, { color: palette.text }]}>{tag.name}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag.id)}>
                      <Text style={styles.removeTag}>{t('profile.remove')}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.tagDescInput, { backgroundColor: palette.glass.bgMedium, color: palette.text, borderColor: palette.glass.border }]}
                    value={tag.desc}
                    onChangeText={(text) => updateTagDesc(tag.id, text)}
                    placeholder={`${t('profile.tagGoalPlaceholder')} ${tag.name}?`}
                    placeholderTextColor={palette.faint}
                    multiline
                    maxLength={90}
                  />
                  <Text style={[styles.charCount, { color: palette.faint }]}>{(tag.desc || '').length}/90</Text>
                  {Array.isArray(tag.focusTags) && tag.focusTags.length > 0 && (
                    <View style={styles.focusTagsRow}>
                      {tag.focusTags.map(focus => (
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

            {/* Danger zone */}
            <View style={[styles.section, styles.tagsSection, styles.dangerSection, { backgroundColor: palette.glass.bg, borderColor: 'rgba(239,68,68,0.25)' }]}>
              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={17} color={colors.red} />
                <Text style={styles.dangerText}>{t('profile.deleteAccount')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  saveBtn: { backgroundColor: colors.purple, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  avatarSection: { alignItems: 'center', paddingVertical: 22 },
  avWrap: { position: 'relative', marginBottom: 8 },
  av: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#c9b6f8', alignItems: 'center', justifyContent: 'center' },
  avImage: { width: 90, height: 90, borderRadius: 45 },
  avText: { fontSize: 28, fontWeight: '700', color: '#3C3489' },
  avEditBtn: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)' },
  changePhotoText: { fontSize: 13, color: colors.purple, fontWeight: '600' },
  section: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, padding: 14 },
  tagsSection: { marginTop: 14 },
  dangerSection: { marginBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  sectionHint: { fontSize: 11, marginBottom: 12 },
  fieldWrap: { paddingVertical: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 14, paddingVertical: 6 },
  inputMulti: { minHeight: 70, lineHeight: 21 },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 2 },
  divider: { height: 1, marginVertical: 10 },
  tagsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tagCountBadge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
  tagCountText:  { fontSize: 11, fontWeight: '800' },
  tagEditor: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  tagEditorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tagDot: { width: 9, height: 9, borderRadius: 5 },
  tagEditorTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  removeTag: { fontSize: 11, color: colors.red, fontWeight: '600' },
  tagDescInput: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, minHeight: 54, fontSize: 12, textAlignVertical: 'top', borderWidth: 1 },
  focusTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  focusTagChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  focusTagText: { fontSize: 10, fontWeight: '700' },
  dangerBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, flexDirection: 'row', gap: 7 },
  dangerText: { fontSize: 13, fontWeight: '600', color: colors.red },
  bottomSpacer: { height: 110 },
});

