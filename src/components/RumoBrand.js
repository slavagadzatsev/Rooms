import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const RUMO_BG     = '#0B0B1A';
export const RUMO_PURPLE = '#8B6BFF';
export const RUMO_PINK   = '#F03BFF';
export const RUMO_MUTED  = '#A0A0A0';

const LOGO = require('../../assets/rumo-icon.png');

export function RumoBackground({ children, style }) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['#070812', '#120E2B', '#211044', '#080812']}
        locations={[0, 0.34, 0.68, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.028)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.015)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export function RumoLogo({ size = 176 }) {
  return (
    <View style={[styles.logoWrap, { width: size, height: size }]}>
      <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
    </View>
  );
}

export function RumoTitleBlock({ title = 'Rumo', subtitle = 'Find people with same goals', logoSize = 168 }) {
  return (
    <View style={styles.titleBlock}>
      <RumoLogo size={logoSize} />
      <View style={styles.copyBlock}>
        <Text style={styles.appName}>{title}</Text>
        <Text style={styles.tagline}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: RUMO_BG,
    overflow: 'hidden',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  titleBlock: {
    alignItems: 'center',
  },
  copyBlock: {
    alignItems: 'center',
    marginTop: 16,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: 0,
    textAlign: 'center',
  },
  tagline: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 9,
    textAlign: 'center',
  },
});
