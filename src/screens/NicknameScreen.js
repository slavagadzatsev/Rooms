import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient'; // used for Continue button
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RumoBackground, RUMO_PURPLE, RUMO_PINK } from '../components/RumoBrand';

const WHITE = '#FFFFFF';

export default function NicknameScreen() {
  const { finishNickname, profile, updateProfile } = useApp();
  const [name, setName] = useState(
    !profile?.name || profile.name === 'Rooms user' || profile.name === 'Rumo user' ? '' : profile.name
  );
  const [avatarUri, setAvatarUri] = useState(profile?.avatarUri ?? null);
  const cleanName   = name.trim();
  const canContinue = cleanName.length >= 2;

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

  const handleContinue = () => {
    if (!canContinue) return;
    if (avatarUri) updateProfile({ avatarUri });
    finishNickname(cleanName);
  };

  const initials = (cleanName || 'R').slice(0, 2).toUpperCase();

  return (
    <RumoBackground>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>

            {/* Avatar preview */}
            <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarCameraBtn}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>

            <Text style={styles.title}>{t('nickname.title')}</Text>
            <Text style={styles.subtitle}>{t('nickname.subtitle')}</Text>

            {/* Input card */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>{t('nickname.label')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('nickname.placeholder')}
                placeholderTextColor="rgba(255,255,255,0.25)"
                maxLength={24}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            {!canContinue && (
              <Text style={styles.hint}>{t('nickname.hint')}</Text>
            )}

            <TouchableOpacity
              style={styles.btn}
              onPress={handleContinue}
              activeOpacity={canContinue ? 0.85 : 1}
              disabled={!canContinue}
            >
              <LinearGradient
                colors={canContinue ? [RUMO_PURPLE, RUMO_PINK] : ['#1E1A36', '#1E1A36']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.btnGrad}
              >
                <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>
                  {t('common.continue')}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={canContinue ? WHITE : 'rgba(255,255,255,0.25)'} />
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RumoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard:  { flex: 1 },
  content:   { flex: 1, justifyContent: 'center', paddingHorizontal: 28, alignItems: 'center', gap: 0 },

  avatarWrap: {
    position: 'relative',
    marginTop: 20, marginBottom: 24,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: 'rgba(255,255,255,0.7)', fontSize: 28, fontWeight: '700' },
  avatarCameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: RUMO_PURPLE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0B0B1A',
  },

  title:    { fontSize: 30, fontWeight: '700', color: WHITE, textAlign: 'center', marginBottom: 10, letterSpacing: 0 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 16, marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 17, fontWeight: '700', color: WHITE,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
  },

  hint: { fontSize: 12, color: 'rgba(255,255,255,0.28)', marginBottom: 20 },

  btn:             { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnGrad:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 17 },
  btnText:         { fontSize: 16, fontWeight: '700', color: WHITE },
  btnTextDisabled: { color: 'rgba(255,255,255,0.25)' },
});
