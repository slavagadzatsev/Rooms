import { Text, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';
import { RumoBackground, RumoLogo } from '../components/RumoBrand';

const APP_VERSION = require('../../app.json')?.expo?.version ?? '1.0.0';

export default function SplashScreen({ onDone }) {
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const fade    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fallback = setTimeout(() => onDone(), 2000);

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(() => { clearTimeout(fallback); onDone(); });
      }, 900);
    });

    return () => clearTimeout(fallback);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <RumoBackground>
        <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
          <RumoLogo size={168} />
          <Text style={styles.appName}>Rumo</Text>
          <Text style={styles.tagline}>Find people with same goals</Text>
        </Animated.View>

        <Text style={styles.version}>v{APP_VERSION}</Text>
      </RumoBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0,
    marginTop: 14,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.56)',
    fontWeight: '500',
  },
  version: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
