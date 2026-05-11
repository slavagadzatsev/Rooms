import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { colors, getPalette, radius } from '../theme';

/**
 * ScreenHeader
 * Props:
 *   title       — строка заголовка
 *   onBack      — функция, если нет — кнопки назад не будет
 *   right       — React element справа (кнопка Save и т.п.)
 */
export default function ScreenHeader({ title, onBack, right }) {
  const { themeMode } = useApp();
  const palette = getPalette(themeMode);

  return (
    <View style={[styles.header, { borderBottomColor: palette.border }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: palette.glass.bgMedium, borderColor: palette.glass.border }]}>
          <Ionicons name="chevron-back" size={20} color={palette.isDark ? '#c4b8ff' : colors.purple} />
        </TouchableOpacity>
      ) : (
        <View style={styles.side} />
      )}

      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.side}>
        {right || null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  side: { minWidth: 36, alignItems: 'flex-end' },
});
