import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

export default function PrimaryButton({ label, onPress, disabled = false, style }) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.purple,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#d5d0f5',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
});
