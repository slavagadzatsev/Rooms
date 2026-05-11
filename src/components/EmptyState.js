import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius } from '../theme';

export default function EmptyState({ iconName = 'search-outline', title, subtitle }) {
  const { themeMode } = useApp();
  const palette = getPalette(themeMode);

  return (
    <View style={[styles.wrap, { backgroundColor: palette.glass.bg, borderColor: palette.glass.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: palette.glass.purpleBg, borderColor: palette.glass.purpleBorder }]}>
        <Ionicons name={iconName} size={30} color={palette.isDark ? '#c4b8ff' : colors.purple} />
      </View>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.subtitle, { color: palette.faint }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '88%',
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: 26,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.faint,
    textAlign: 'center',
    lineHeight: 20,
  },
});
