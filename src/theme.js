export const colors = {
  purple: '#6B5CE7',
  purpleSoft: '#f4f3ff',
  purplePale: '#ede9ff',
  border: '#f0eeff',
  borderStrong: '#e8e6ff',
  text: '#111111',
  muted: '#888888',
  faint: '#bbbbbb',
  white: '#ffffff',
  green: '#22c55e',
  red: '#ef4444',
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  screen: 16,
};

export const getPalette = (mode = 'light') => {
  const isDark = mode === 'dark';

  // Glass-specific values — основа glassmorphism
  const glass = isDark
    ? {
        // Тёмное стекло
        bg:           'rgba(255, 255, 255, 0.06)',
        bgMedium:     'rgba(255, 255, 255, 0.10)',
        bgStrong:     'rgba(255, 255, 255, 0.15)',
        border:       'rgba(255, 255, 255, 0.10)',
        borderStrong: 'rgba(255, 255, 255, 0.18)',
        purpleBg:     'rgba(107, 92, 231, 0.20)',
        purpleBorder: 'rgba(107, 92, 231, 0.45)',
        shadow:       'rgba(0, 0, 0, 0.50)',
        tabBg:        'rgba(14, 11, 30, 0.75)',
      }
    : {
        // Светлое стекло
        bg:           'rgba(243, 241, 255, 0.72)',
        bgMedium:     'rgba(253, 252, 255, 0.88)',
        bgStrong:     'rgba(255, 255, 255, 0.96)',
        border:       'rgba(107, 92, 231, 0.14)',
        borderStrong: 'rgba(107, 92, 231, 0.30)',
        purpleBg:     'rgba(107, 92, 231, 0.10)',
        purpleBorder: 'rgba(107, 92, 231, 0.28)',
        shadow:       'rgba(107, 92, 231, 0.12)',
        tabBg:        'rgba(255, 255, 255, 0.75)',
      };

  return {
    isDark,
    // Фон — чуть более глубокий фиолетовый для dark, чтобы glass смотрелся красиво
    bg:           isDark ? '#0e0b1e' : colors.white,
    bgGrad:       isDark ? ['#0e0b1e', '#150e2e', '#0e0b1e'] : ['#f8f7ff', '#eeeaff', '#f8f7ff'],
    surface:      isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.90)',
    surfaceSoft:  isDark ? 'rgba(255,255,255,0.05)' : colors.purpleSoft,
    surfacePale:  isDark ? 'rgba(107,92,231,0.15)'  : colors.purplePale,
    text:         isDark ? '#f0ecff' : colors.text,
    muted:        isDark ? '#b8b3c9' : colors.muted,
    faint:        isDark ? '#7a7490' : colors.faint,
    border:       isDark ? 'rgba(255,255,255,0.09)' : colors.border,
    borderStrong: isDark ? 'rgba(255,255,255,0.16)' : colors.borderStrong,
    purple:       colors.purple,
    green:        colors.green,
    red:          colors.red,
    white:        colors.white,
    glass,
  };
};
