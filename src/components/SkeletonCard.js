import { View, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { getPalette, radius } from '../theme';

export default function SkeletonCard({ mode = 'list' }) {
  const { themeMode } = useApp();
  const palette = getPalette(themeMode);
  const pulse   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const animBg = pulse.interpolate({
    inputRange:  [0, 1],
    outputRange: [palette.glass.bg, palette.glass.bgStrong],
  });

  const cardStyle = { backgroundColor: palette.glass.bg, borderColor: palette.glass.border };

  if (mode === 'list') {
    return (
      <View style={[styles.listCard, cardStyle]}>
        <Animated.View style={[styles.listAvatar, { backgroundColor: animBg }]} />
        <View style={styles.listBody}>
          <Animated.View style={[styles.line, styles.lineTitle, { backgroundColor: animBg }]} />
          <Animated.View style={[styles.line, styles.lineSub,   { backgroundColor: animBg }]} />
        </View>
        <Animated.View style={[styles.listBadge, { backgroundColor: animBg }]} />
      </View>
    );
  }

  // feed mode (HomeScreen cards)
  return (
    <View style={[styles.feedCard, cardStyle]}>
      <Animated.View style={[styles.feedAvatar, { backgroundColor: animBg }]} />
      <View style={styles.feedBody}>
        <View style={styles.feedTopRow}>
          <Animated.View style={[styles.line, styles.lineTitleFeed, { backgroundColor: animBg }]} />
          <Animated.View style={[styles.line, styles.lineTime,      { backgroundColor: animBg }]} />
        </View>
        <Animated.View style={[styles.line, styles.lineFull,  { backgroundColor: animBg }]} />
        <Animated.View style={[styles.line, styles.lineMedium, { backgroundColor: animBg }]} />
        <View style={styles.feedTagsRow}>
          {[40, 55, 45].map((w, i) => (
            <Animated.View key={i} style={[styles.tag, { width: w, backgroundColor: animBg }]} />
          ))}
        </View>
        <View style={styles.feedBottom}>
          <Animated.View style={[styles.line, styles.lineSmall, { backgroundColor: animBg }]} />
          <Animated.View style={[styles.joinBtn, { backgroundColor: animBg }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // List mode
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  listAvatar:  { width: 56, height: 56, borderRadius: 16, flexShrink: 0 },
  listBody:    { flex: 1, gap: 8 },
  listBadge:   { width: 24, height: 24, borderRadius: 12, flexShrink: 0 },

  // Feed mode
  feedCard: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
  },
  feedAvatar:  { width: 64, height: 64, borderRadius: 18, flexShrink: 0 },
  feedBody:    { flex: 1, gap: 0 },
  feedTopRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feedTagsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  feedBottom:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tag:         { height: 22, borderRadius: 11 },
  joinBtn:     { width: 60, height: 26, borderRadius: 13 },

  // Shared line shapes
  line:         { borderRadius: 6 },
  lineTitle:    { height: 13, width: '60%', marginBottom: 0 },
  lineTitleFeed:{ height: 13, width: '55%' },
  lineSub:      { height: 11, width: '80%' },
  lineFull:     { height: 11, width: '95%', marginBottom: 6 },
  lineMedium:   { height: 11, width: '70%', marginBottom: 8 },
  lineTime:     { height: 10, width: 36 },
  lineSmall:    { height: 11, width: 80 },
});
