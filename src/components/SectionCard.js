import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius, spacing } from '../theme';

/**
 * SectionCard
 * Props:
 *   title     — необязательный заголовок секции
 *   style     — дополнительные стили для контейнера
 *   children  — содержимое
 */
export default function SectionCard({ title, style, children }) {
  const { themeMode } = useApp();
  const palette = getPalette(themeMode);

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>
      {title ? (
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screen,
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
});
