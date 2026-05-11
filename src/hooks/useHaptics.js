import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Safe wrapper — haptics only on native, silently no-ops on web
const isNative = Platform.OS !== 'web';

export const haptics = {
  /** Light tap — tab press, chip select, toggle */
  light: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),

  /** Medium tap — button press, card press */
  medium: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),

  /** Heavy tap — destructive action, long-press trigger */
  heavy: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),

  /** Success — message sent, room created, saved */
  success: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),

  /** Error — validation fail */
  error: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),

  /** Selection change — tab switch, picker change */
  select: () => isNative && Haptics.selectionAsync(),
};
