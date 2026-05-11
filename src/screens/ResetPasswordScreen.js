import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius } from '../theme';
import {
  exchangeRecoveryCode,
  setRecoverySession,
  updatePassword,
} from '../services/authService';
import { getSupabaseStatus } from '../services/supabaseClient';
import { t } from '../i18n';

export default function ResetPasswordScreen({ navigation, route }) {
  const { login, themeMode, isLoggedIn, hasOnboarded, hasNickname } = useApp();
  const palette = getPalette(themeMode ?? 'light');
  const params = route?.params || {};
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const passwordOk = password.length >= 6;
  const matches = password === confirm;
  const canSubmit = sessionReady && passwordOk && matches && !loading;

  useEffect(() => {
    let alive = true;
    const prepareRecoverySession = async () => {
      const hasRecoveryParams = Boolean(params.code || (params.access_token && params.refresh_token));
      if (!hasRecoveryParams) {
        const fallbackRoute = !hasOnboarded
          ? 'Onboarding'
          : !isLoggedIn
            ? 'Auth'
            : !hasNickname
              ? 'Nickname'
              : 'Main';
        navigation.replace(fallbackRoute);
        return;
      }
      if (!getSupabaseStatus().configured) {
        setSessionError(t('resetPassword.supabaseMissing'));
        return;
      }
      setLoading(true);
      try {
        let session = null;
        if (params.code) {
          session = await exchangeRecoveryCode(params.code);
        } else if (params.access_token && params.refresh_token) {
          session = await setRecoverySession({
            accessToken: params.access_token,
            refreshToken: params.refresh_token,
          });
        } else {
          session = null;
        }
        if (!alive) return;
        if (session?.user) {
          login(session.user);
          setSessionReady(true);
        } else {
          setSessionError(t('resetPassword.openLinkAgain'));
        }
      } catch (error) {
        if (alive) setSessionError(error.message || t('resetPassword.linkInvalid'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    prepareRecoverySession();
    return () => { alive = false; };
  }, [
    hasNickname,
    hasOnboarded,
    isLoggedIn,
    navigation,
    params.access_token,
    params.code,
    params.refresh_token,
  ]);

  const handleSave = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const user = await updatePassword(password);
      if (user) login(user);
      Alert.alert(t('resetPassword.updatedTitle'), t('resetPassword.updatedDesc'), [
        { text: t('resetPassword.continue'), onPress: () => navigation.replace('Main') },
      ]);
    } catch (error) {
      Alert.alert(t('resetPassword.errorTitle'), error.message || t('resetPassword.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <View style={[styles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
              <View style={styles.iconWrap}>
                <Ionicons name="key-outline" size={26} color={colors.white} />
              </View>

              <Text style={[styles.title, { color: palette.text }]}>{t('resetPassword.title')}</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>
                {t('resetPassword.subtitle')}
              </Text>

              {!!sessionError && (
                <View style={[styles.warning, { backgroundColor: palette.glass.bgMedium, borderColor: colors.red + '55' }]}>
                  <Ionicons name="alert-circle-outline" size={17} color={colors.red} />
                  <Text style={[styles.warningText, { color: palette.text }]}>{sessionError}</Text>
                </View>
              )}

              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border, color: palette.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('resetPassword.newPassword')}
                  placeholderTextColor={palette.faint}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(prev => !prev)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border, color: palette.text }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t('resetPassword.confirmPassword')}
                placeholderTextColor={palette.faint}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />

              {!passwordOk && password.length > 0 && (
                <Text style={styles.errorText}>{t('resetPassword.minChars')}</Text>
              )}
              {!matches && confirm.length > 0 && (
                <Text style={styles.errorText}>{t('resetPassword.noMatch')}</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.btn,
                  { backgroundColor: canSubmit ? colors.purple : palette.glass.bgMedium, borderColor: canSubmit ? colors.purple : palette.glass.border },
                ]}
                onPress={handleSave}
                activeOpacity={canSubmit ? 0.84 : 1}
                disabled={!canSubmit}
              >
                <Text style={[styles.btnText, { color: canSubmit ? colors.white : palette.faint }]}>
                  {loading ? t('resetPassword.pleaseWait') : t('resetPassword.savePassword')}
                </Text>
                <Ionicons name="checkmark-circle-outline" size={18} color={canSubmit ? colors.white : palette.faint} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Auth')}>
                <Text style={[styles.backText, { color: palette.muted }]}>{t('resetPassword.backToLogin')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  card: { borderWidth: 1, borderRadius: 28, padding: 22 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  warning: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 14 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  inputWrap: { position: 'relative', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  eyeBtn: { position: 'absolute', right: 12, top: 11, padding: 4 },
  errorText: { color: colors.red, fontSize: 11.5, fontWeight: '700', marginBottom: 7 },
  btn: { marginTop: 10, borderRadius: radius.lg, borderWidth: 1, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '900' },
  backBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  backText: { fontSize: 13, fontWeight: '800' },
});
