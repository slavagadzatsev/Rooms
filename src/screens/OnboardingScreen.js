import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TAG_CATEGORIES } from '../data/mockRooms';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../components/TagAccordion';
import { RumoBackground, RumoLogo, RUMO_PURPLE, RUMO_PINK, RUMO_BG } from '../components/RumoBrand';
import { t } from '../i18n';

const { width } = Dimensions.get('window');
const WHITE = '#FFFFFF';

const INTEREST_PRESETS = {
  learning:   { label: 'Learning',   desc: 'Study together, stay consistent.',            keywords: ['learning','course','study','education','language','mentor'] },
  projects:   { label: 'Projects',   desc: 'Build apps, products, games or startups.',    keywords: ['project','startup','app','product','developer','design','game'] },
  content:    { label: 'Content',    desc: 'Grow channels, podcasts or social media.',    keywords: ['content','youtube','video','editing','creator','channel'] },
  networking: { label: 'Networking', desc: 'Meet collaborators, mentors and co-founders.',keywords: ['networking','collaboration','mentor','community','team'] },
  hobbies:    { label: 'Hobbies',    desc: 'Games, music, art, books, fitness.',          keywords: ['gaming','music','art','books','fitness','game'] },
};

const SLIDES = [
  {
    key:      'intro',
    title:    'Find people\nwith same goals',
    subtitle: 'Rumo connects you with people who share the same goals — not just the same interests.',
  },
  {
    key:      'how',
    title:    'How Rumo works',
    subtitle: 'Join goal-based rooms, chat, pulse to keep them alive, and build your team.',
    steps: [
      { icon: 'search-outline',     text: 'Pick your interests' },
      { icon: 'people-outline',     text: 'Discover goal-based rooms' },
      { icon: 'chatbubbles-outline',text: 'Chat and build together' },
      { icon: 'flash-outline',      text: 'Pulse to keep rooms alive' },
    ],
  },
  {
    key:        'interests',
    title:      'What are you into?',
    subtitle:   'Pick your areas so Rumo shows you the right rooms.',
    hasSpheres: true,
  },
];

export default function OnboardingScreen() {
  const { finishOnboarding, updateProfileTags, profileTags } = useApp();
  const [step, setStep]                 = useState(0);
  const [selectedSpheres, setSelectedSpheres] = useState(() =>
    TAG_CATEGORIES
      .filter(cat => profileTags.some(t => t.id === cat.key || t.name === (INTEREST_PRESETS[cat.key]?.label || cat.label)))
      .map(cat => cat.key)
  );
  const [selectedTags, setSelectedTags] = useState([]);
  const [goalText, setGoalText]         = useState('');

  const slides = [
    {
      key: 'intro',
      title: t('onboarding.introTitle'),
      subtitle: t('onboarding.introSubtitle'),
    },
    {
      key: 'how',
      title: t('onboarding.howTitle'),
      subtitle: t('onboarding.howSubtitle'),
      steps: [
        { icon: 'search-outline', text: t('onboarding.steps.interests') },
        { icon: 'people-outline', text: t('onboarding.steps.discover') },
        { icon: 'chatbubbles-outline', text: t('onboarding.steps.chat') },
        { icon: 'flash-outline', text: t('onboarding.steps.pulse') },
      ],
    },
    {
      key: 'interests',
      title: t('onboarding.interestsTitle'),
      subtitle: t('onboarding.interestsSubtitle'),
      hasSpheres: true,
    },
  ];

  const slide   = slides[step];
  const isLast  = step === slides.length - 1;
  const canNext = slide.hasSpheres ? selectedSpheres.length > 0 : true;

  const toggleSphere = (key) => {
    setSelectedSpheres(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (!next.includes(key)) {
        const cat = TAG_CATEGORIES.find(c => c.key === key);
        if (cat) setSelectedTags(tags => tags.filter(t => !cat.tags.includes(t)));
      }
      return next;
    });
  };

  const toggleTag = (tag) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const completeOnboarding = () => {
    if (selectedSpheres.length > 0) {
      const cleanGoal = goalText.trim();
      const goalWords = cleanGoal.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
      const tags = selectedSpheres.map(key => {
        const cat       = TAG_CATEGORIES.find(c => c.key === key);
        const color     = CATEGORY_COLORS[key] || RUMO_PURPLE;
        const preset    = INTEREST_PRESETS[key];
        const name      = preset?.label || cat?.label || key;
        const focusTags = selectedTags.filter(t => cat?.tags.includes(t));
        const baseDesc  = cleanGoal || preset?.desc || `I want to find rooms about ${name}.`;
        const focusText = focusTags.length > 0 ? ` Focus: ${focusTags.join(', ')}.` : '';
        return {
          id: key, name, color,
          desc: `${baseDesc}${focusText}`,
          focusTags,
          keywords: [...new Set([...(preset?.keywords || [key, name.toLowerCase()]), ...focusTags.map(t => t.toLowerCase()), ...goalWords])],
        };
      });
      updateProfileTags(tags);
    }
    finishOnboarding();
  };

  const handleNext = () => {
    if (!canNext) return;
    if (isLast) { completeOnboarding(); return; }
    setStep(s => s + 1);
  };

  return (
    <RumoBackground>
      <SafeAreaView style={styles.container}>

        {/* Top bar — dots + skip */}
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
            ))}
          </View>
          {step < 2 ? (
            <TouchableOpacity onPress={() => setStep(2)} style={styles.skipBtn}>
              <Text style={styles.skipText}>{t('common.skip')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Content */}
        {slide.hasSpheres ? (

          /* ── Interests slide ── */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.logoCenter}>
              <RumoLogo size={72} />
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>

            <View style={styles.spheresGrid}>
              {TAG_CATEGORIES.map(cat => {
                const active = selectedSpheres.includes(cat.key);
                const col    = CATEGORY_COLORS[cat.key] || RUMO_PURPLE;
                const preset = INTEREST_PRESETS[cat.key];
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.sphereCard, active && { borderColor: col, backgroundColor: col + '15' }]}
                    onPress={() => toggleSphere(cat.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={CATEGORY_ICONS[cat.key] || 'pricetag-outline'} size={26} color={active ? col : 'rgba(255,255,255,0.30)'} />
                    <Text style={[styles.sphereLabel, active && { color: col }]}>{preset?.label || cat.label}</Text>
                    <Text style={styles.sphereDesc} numberOfLines={2}>{preset?.desc || 'Find matching rooms'}</Text>
                    {active && (
                      <View style={[styles.sphereCheck, { backgroundColor: col }]}>
                        <Ionicons name="checkmark" size={10} color={WHITE} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedSpheres.length > 0 && (
              <View style={styles.focusBlock}>
                <Text style={styles.focusTitle}>{t('onboarding.focusTitle')}</Text>
                <Text style={styles.focusSubtitle}>{t('onboarding.focusSubtitle')}</Text>
                {selectedSpheres.map(key => {
                  const cat = TAG_CATEGORIES.find(c => c.key === key);
                  const col = CATEGORY_COLORS[key] || RUMO_PURPLE;
                  if (!cat) return null;
                  return (
                    <View key={key} style={styles.tagGroup}>
                      <Text style={[styles.tagGroupTitle, { color: col }]}>{INTEREST_PRESETS[key]?.label || cat.label}</Text>
                      <View style={styles.tagWrap}>
                        {cat.tags.slice(0, 8).map(tag => {
                          const isActive = selectedTags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              style={[styles.tagChip, isActive && { backgroundColor: col + '20', borderColor: col }]}
                              onPress={() => toggleTag(tag)}
                              activeOpacity={0.75}
                            >
                              {isActive && <Ionicons name="checkmark" size={10} color={col} />}
                              <Text style={[styles.tagText, isActive && { color: col }]}>{tag}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <TextInput
                  style={styles.goalInput}
                  value={goalText}
                  onChangeText={setGoalText}
                  placeholder={t('onboarding.goalPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  maxLength={90}
                  multiline
                />
              </View>
            )}
          </ScrollView>

        ) : (

          /* ── Intro / How slides ── */
          <View style={styles.centerSlide}>
            <RumoLogo size={120} />
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>

            {slide.steps && (
              <View style={styles.stepsCard}>
                {slide.steps.map((s, i) => (
                  <View key={i} style={[styles.stepRow, i < slide.steps.length - 1 && styles.stepRowBorder]}>
                    <View style={styles.stepIconWrap}>
                      <Ionicons name={s.icon} size={20} color={RUMO_PURPLE} />
                    </View>
                    <Text style={styles.stepText}>{s.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {slide.hasSpheres && selectedSpheres.length === 0 && (
            <Text style={styles.hint}>{t('onboarding.chooseInterest')}</Text>
          )}
          <LinearGradient
            colors={canNext ? [RUMO_PURPLE, RUMO_PINK] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.nextGradWrap}
          >
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleNext}
              activeOpacity={canNext ? 0.85 : 1}
              disabled={!canNext}
            >
              <Text style={[styles.nextText, !canNext && styles.nextTextDisabled]}>
                {isLast ? t('onboarding.getStarted') : t('common.next')}
              </Text>
              {!isLast && <Ionicons name="arrow-forward" size={18} color={canNext ? WHITE : 'rgba(255,255,255,0.25)'} />}
            </TouchableOpacity>
          </LinearGradient>
        </View>

      </SafeAreaView>
    </RumoBackground>
  );
}

const SPHERE_W = (width - 24 * 2 - 10) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Top bar
  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  dots:      { flexDirection: 'row', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: RUMO_PURPLE },
  dotDone:   { backgroundColor: 'rgba(139,107,255,0.40)' },
  skipBtn:   { paddingVertical: 4, paddingHorizontal: 2 },
  skipText:  { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  // Centered slides
  centerSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  slideTitle: {
    fontSize: 28, fontWeight: '600', color: WHITE,
    textAlign: 'center', letterSpacing: 0, lineHeight: 36,
  },
  slideSubtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.52)',
    textAlign: 'center', lineHeight: 23, fontWeight: '400',
  },

  // Steps card (How it works)
  stepsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  stepRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  stepIconWrap:  { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(139,107,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  stepText:      { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.72)', flex: 1 },

  // Interests scroll
  scrollContent: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 16 },
  logoCenter:    { alignItems: 'center', marginBottom: 20 },

  spheresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 16 },
  sphereCard: {
    width: SPHERE_W, minHeight: 118,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14, paddingHorizontal: 12,
    alignItems: 'center', gap: 6, position: 'relative',
  },
  sphereLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  sphereDesc:  { fontSize: 10, lineHeight: 13, color: 'rgba(255,255,255,0.28)', textAlign: 'center' },
  sphereCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // Focus block
  focusBlock:    { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 14, marginBottom: 10 },
  focusTitle:    { fontSize: 14, fontWeight: '600', color: WHITE, marginBottom: 4 },
  focusSubtitle: { fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.32)', marginBottom: 12 },
  tagGroup:      { marginBottom: 12 },
  tagGroupTitle: { fontSize: 11, fontWeight: '700', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.6 },
  tagWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  goalInput: {
    minHeight: 44, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: WHITE, textAlignVertical: 'top',
  },

  // Footer
  footer:           { paddingHorizontal: 24, paddingBottom: 28, alignItems: 'center', gap: 10 },
  hint:             { fontSize: 12, color: 'rgba(255,255,255,0.28)' },
  nextGradWrap:     { width: '100%', borderRadius: 18, padding: 0 },
  nextBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  nextText:         { fontSize: 17, fontWeight: '600', color: WHITE },
  nextTextDisabled: { color: 'rgba(255,255,255,0.25)' },
});
