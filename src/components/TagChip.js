import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { haptics } from '../hooks/useHaptics';
import { colors, getPalette, radius } from '../theme';

export default function TagChip({ label, active = false, onPress, compact = false, iconName }) {
  const { themeMode } = useApp();
  const palette = getPalette(themeMode);
  const isDark = palette.isDark;

  const handlePress = () => {
    if (!onPress) return;
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? palette.glass.purpleBg
            : palette.glass.bg,
          borderColor: active
            ? palette.glass.purpleBorder
            : palette.glass.border,
        },
        compact && styles.compact,
      ]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.70 : 1}
    >
      <View style={styles.content}>
        {active && (
          <Ionicons
            name="checkmark-circle"
            size={compact ? 11 : 13}
            color={isDark ? '#c4b8ff' : colors.purple}
          />
        )}
        {!!iconName && (
          <Ionicons
            name={iconName}
            size={compact ? 11 : 13}
            color={active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted}
          />
        )}
        <Text
          style={[
            styles.text,
            { color: active ? (isDark ? '#c4b8ff' : colors.purple) : palette.muted },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.88}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  compact: {
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
