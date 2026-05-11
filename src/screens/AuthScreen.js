import {
  View, Text, TextInput, TouchableOpacity, Alert, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { resetPasswordForEmail, signInWithEmail, signInWithOAuth, signUpWithEmail } from '../services/authService';
import { getSupabaseStatus } from '../services/supabaseClient';
import { APP_CONFIG } from '../config/appConfig';
import { t } from '../i18n';
import { RumoBackground, RumoTitleBlock, RUMO_BG, RUMO_PURPLE, RUMO_PINK } from '../components/RumoBrand';

const WHITE  = '#FFFFFF';
const GOOGLE_LOGO = require('../../assets/google-logo.png');

// ── Logo ──────────────────────────────────────────────────────────────────────
// ── Screen ────────────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const [emailMode, setEmailMode] = useState(false);
  const [mode,      setMode]      = useState('login');
  const { login, profile }        = useApp();
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  const isLogin           = mode === 'login';
  const allowGuest        = APP_CONFIG.allowGuest;
  const emailTrimmed      = email.trim();
  const nameTrimmed       = name.trim();
  const profileName       = nameTrimmed || profile?.name?.trim() || 'Rumo user';
  const supabaseConfigured = getSupabaseStatus().configured;

  const nameError     = submitted && !isLogin && nameTrimmed.length < 2 ? t('auth.nameError') : null;
  const emailError    = submitted && !/^\S+@\S+\.\S+$/.test(emailTrimmed) ? t('auth.emailError') : null;
  const passwordError = submitted && password.length < 6 ? t('auth.passwordError') : null;
  const canSubmit     = /^\S+@\S+\.\S+$/.test(emailTrimmed) && password.length >= 6 && (isLogin || nameTrimmed.length >= 2);

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!canSubmit) return;
    setLoading(true);
    try {
      let authUser = null;
      if (supabaseConfigured) {
        if (isLogin) {
          const data = await signInWithEmail({ email: emailTrimmed, password });
          authUser = data.user;
        } else {
          const data = await signUpWithEmail({ name: profileName, email: emailTrimmed, password });
          if (!data.session) {
            Alert.alert(t('auth.checkEmailTitle'), t('auth.checkEmailMessage'));
            return;
          }
          authUser = data.user;
        }
      } else if (!allowGuest) {
        Alert.alert(t('auth.backendRequiredTitle'), t('auth.backendRequiredMessage'));
        return;
      }
      login(authUser);
    } catch (error) {
      Alert.alert(t('auth.authErrorTitle'), error.message || t('auth.authErrorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!/^\S+@\S+\.\S+$/.test(emailTrimmed)) {
      Alert.alert(t('auth.resetTitle'), t('auth.resetEnterEmail'));
      return;
    }
    if (!supabaseConfigured) {
      Alert.alert(t('auth.resetTitle'), t('auth.resetNeedsBackend'));
      return;
    }
    setLoading(true);
    try {
      await resetPasswordForEmail(emailTrimmed);
      Alert.alert(t('auth.checkEmailTitle'), t('auth.resetSent'));
    } catch (error) {
      Alert.alert(t('auth.resetTitle'), error.message || t('auth.authErrorMessage'));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (!supabaseConfigured) {
      Alert.alert(t('auth.backendRequiredTitle'), `${provider === 'google' ? 'Google' : 'Apple'} login will work after Supabase is connected.`);
      return;
    }
    setLoading(true);
    try {
      const session = await signInWithOAuth(provider);
      if (session?.user) login(session.user);
    } catch (error) {
      Alert.alert(t('auth.socialTitle'), error.message || t('auth.socialError'));
    } finally {
      setLoading(false);
    }
  };

  // ── Landing view ────────────────────────────────────────────────────────────
  if (!emailMode) {
    return (
      <RumoBackground>
        <SafeAreaView style={styles.landing}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.brandStage}>
              <RumoTitleBlock logoSize={196} />
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsSection}>
            <TouchableOpacity style={styles.btnLight} onPress={() => handleOAuth('apple')} disabled={loading} activeOpacity={0.88}>
              <Ionicons name="logo-apple" size={24} color="#050510" />
              <Text style={styles.btnLightText}>{t('auth.continueApple')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnLight} onPress={() => handleOAuth('google')} disabled={loading} activeOpacity={0.88}>
              <AntDesign name="google" size={22} color="#4285F4" />
              <Text style={styles.btnLightText}>{t('auth.continueGoogle')}</Text>
            </TouchableOpacity>

            {/* Email button — gradient border */}
            <LinearGradient
              colors={[RUMO_PURPLE, RUMO_PINK]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.btnEmailGradBorder}
            >
              <TouchableOpacity style={styles.btnEmailInner} onPress={() => setEmailMode(true)} activeOpacity={0.88}>
                <Ionicons name="mail-outline" size={25} color={RUMO_PURPLE} />
                <Text style={styles.btnDarkText}>{t('auth.continueEmail')}</Text>
              </TouchableOpacity>
            </LinearGradient>

            {allowGuest && (
              <TouchableOpacity style={styles.guestLink} onPress={() => login()} activeOpacity={0.7}>
                <Text style={styles.guestLinkText}>{t('auth.continueGuest')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            {t('auth.termsPrefix')}
            <Text style={styles.termsLink} onPress={() => Linking.openURL(APP_CONFIG.legal.termsUrl)}>{t('auth.termsService')}</Text>
            {t('auth.termsMiddle')}
            <Text style={styles.termsLink} onPress={() => Linking.openURL(APP_CONFIG.legal.privacyUrl)}>{t('auth.privacyPolicy')}</Text>
            {'.'}
          </Text>
        </SafeAreaView>
      </RumoBackground>
    );
  }

  // ── Email form view ─────────────────────────────────────────────────────────
  return (
    <RumoBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => { setEmailMode(false); setSubmitted(false); }}>
              <Ionicons name="chevron-back" size={22} color={WHITE} />
            </TouchableOpacity>

            <Text style={styles.formTitle}>{isLogin ? t('auth.signIn') : t('auth.createAccount')}</Text>

            {/* Toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
                onPress={() => { setMode('login'); setSubmitted(false); setName(''); }}
              >
                <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>{t('auth.login')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
                onPress={() => { setMode('register'); setSubmitted(false); }}
              >
                <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>{t('auth.signup')}</Text>
              </TouchableOpacity>
            </View>

            {/* Fields */}
            <View style={styles.form}>
              {!isLogin && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
                    <TextInput
                      style={[styles.fieldInput, nameError && styles.fieldInputError]}
                      placeholder="Your name"
                      placeholderTextColor="#444"
                      value={name}
                      onChangeText={v => { setName(v); if (submitted) setSubmitted(false); }}
                      autoCapitalize="words"
                    />
                    {nameError && <Text style={styles.errorText}>{nameError}</Text>}
                  </View>
                  <View style={styles.fieldDivider} />
                </>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
                <TextInput
                  style={[styles.fieldInput, emailError && styles.fieldInputError]}
                  placeholder="your@email.com"
                  placeholderTextColor="#444"
                  value={email}
                  onChangeText={v => { setEmail(v); if (submitted) setSubmitted(false); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {emailError && <Text style={styles.errorText}>{emailError}</Text>}
              </View>

              <View style={styles.fieldDivider} />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
                <View>
                  <TextInput
                    style={[styles.fieldInput, passwordError && styles.fieldInputError]}
                    placeholder={t('auth.passwordPlaceholder')}
                    placeholderTextColor="#444"
                    value={password}
                    onChangeText={v => { setPassword(v); if (submitted) setSubmitted(false); }}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(p => !p)}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#555" />
                  </TouchableOpacity>
                </View>
                {isLogin && (
                  <TouchableOpacity onPress={handleResetPassword} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                    <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
                  </TouchableOpacity>
                )}
                {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, submitted && !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={loading ? 1 : 0.85}
            >
              <LinearGradient
                colors={[RUMO_PURPLE, '#A040F0']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.submitGrad}
              >
                <Text style={styles.submitText}>
                  {loading ? t('auth.wait') : isLogin ? t('auth.login') : t('auth.createAccount')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Switch mode */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{isLogin ? t('auth.noAccount') : t('auth.hasAccount')}</Text>
              <TouchableOpacity onPress={() => { setMode(isLogin ? 'register' : 'login'); setSubmitted(false); }}>
                <Text style={styles.switchLink}>{isLogin ? t('auth.signup') : t('auth.login')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </RumoBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RUMO_BG },

  // Landing
  landing:     { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 34, paddingTop: 0 },
  logoSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 26 },
  brandStage:  { alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  appName:     { fontSize: 46, fontWeight: '800', color: WHITE, letterSpacing: -1.5 },
  tagline:     { fontSize: 15, color: 'rgba(255,255,255,0.42)', textAlign: 'center' },

  buttonsSection: { gap: 13, marginBottom: 26, alignItems: 'center' },
  btnLight: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    width: '94%',
    backgroundColor: WHITE, borderRadius: 18, paddingVertical: 16,
    shadowColor: '#fff',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  btnLightText: { fontSize: 18, fontWeight: '500', color: '#050510', letterSpacing: 0.1 },
  googleIcon:   { width: 24, height: 24 },

  // Email button gradient border
  btnEmailGradBorder: { width: '94%', borderRadius: 21, padding: 2 },
  btnEmailInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    backgroundColor: 'rgba(8,8,18,0.94)', borderRadius: 18.5, paddingVertical: 15,
  },
  btnDarkText:   { fontSize: 18, fontWeight: '500', color: WHITE, letterSpacing: 0.1 },
  guestLink:     { alignItems: 'center', paddingVertical: 6 },
  guestLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.30)', fontWeight: '500' },

  terms:     { fontSize: 14, color: 'rgba(255,255,255,0.54)', textAlign: 'center', lineHeight: 23, paddingHorizontal: 8, fontWeight: '400' },
  termsLink: { color: RUMO_PURPLE },

  // Email form
  formScroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  formTitle:  { fontSize: 30, fontWeight: '700', color: WHITE, marginBottom: 22, letterSpacing: 0 },

  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 4, marginBottom: 24, gap: 4,
  },
  toggleBtn:       { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: 'rgba(124,92,246,0.28)', borderWidth: 1, borderColor: 'rgba(124,92,246,0.45)' },
  toggleText:       { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.38)' },
  toggleTextActive: { color: WHITE },

  form: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 16, marginBottom: 20,
  },
  field:          { gap: 8, paddingVertical: 4 },
  fieldLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase' },
  fieldInput:     {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: WHITE,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
  },
  fieldInputError: { borderColor: '#EF4444' },
  fieldDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 10 },
  eyeBtn:          { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  forgotText:      { fontSize: 13, color: RUMO_PURPLE, fontWeight: '500' },
  errorText:       { fontSize: 11, color: '#EF4444', fontWeight: '600' },

  submitBtn:        { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  submitBtnDisabled:{ opacity: 0.55 },
  submitGrad:       { paddingVertical: 17, alignItems: 'center' },
  submitText:       { fontSize: 16, fontWeight: '700', color: WHITE },

  switchRow:  { flexDirection: 'row', justifyContent: 'center' },
  switchText: { fontSize: 14, color: 'rgba(255,255,255,0.38)' },
  switchLink: { fontSize: 14, fontWeight: '700', color: RUMO_PURPLE },
});
