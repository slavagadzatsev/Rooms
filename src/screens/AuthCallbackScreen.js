import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius } from '../theme';
import { exchangeAuthCode, setAuthSession } from '../services/authService';
import { getSupabaseStatus } from '../services/supabaseClient';
import { t } from '../i18n';

export default function AuthCallbackScreen({ navigation, route }) {
  const { login, themeMode } = useApp();
  const palette = getPalette(themeMode ?? 'light');
  const params = route?.params || {};
  const [message, setMessage] = useState(t('authCallback.completing'));
  const [failed,  setFailed]  = useState(false);

  useEffect(() => {
    let alive = true;
    const completeAuth = async () => {
      if (!getSupabaseStatus().configured) {
        if (alive) { setMessage(t('authCallback.supabaseMissing')); setFailed(true); }
        return;
      }
      try {
        let session = null;
        if (params.code) {
          session = await exchangeAuthCode(params.code);
        } else if (params.access_token && params.refresh_token) {
          session = await setAuthSession({
            accessToken: params.access_token,
            refreshToken: params.refresh_token,
          });
        }

        if (!alive) return;
        if (session?.user) {
          login(session.user);
          navigation.replace('Main');
          return;
        }

        setMessage(t('authCallback.failed'));
        setFailed(true);
      } catch (error) {
        if (alive) { setMessage(error.message || t('authCallback.failedShort')); setFailed(true); }
      }
    };

    completeAuth();
    return () => { alive = false; };
  }, [navigation, params.access_token, params.code, params.refresh_token]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={palette.bgGrad} style={StyleSheet.absoluteFill} locations={[0, 0.5, 1]} />
      <SafeAreaView style={styles.container}>
        <View style={[styles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
          {!failed && <ActivityIndicator color={colors.purple} />}
          <Text style={[styles.title, { color: palette.text }]}>Rumo</Text>
          <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
          {failed && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.replace('Auth')}
              activeOpacity={0.82}
            >
              <Text style={styles.backBtnText}>{t('authCallback.back')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '900' },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  backBtn: {
    backgroundColor: colors.purple,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 4,
  },
  backBtnText: { color: colors.white, fontSize: 13, fontWeight: '800' },
});
