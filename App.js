import 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState } from 'react';

import { AppProvider, useApp } from './src/context/AppContext';
import { getPalette } from './src/theme';
import { navigationRef } from './src/utils/navigationRef';
import SplashScreen     from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen       from './src/screens/AuthScreen';
import AuthCallbackScreen from './src/screens/AuthCallbackScreen';
import NicknameScreen   from './src/screens/NicknameScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import TabNavigator     from './src/navigation/TabNavigator';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';

const Root = createNativeStackNavigator();

const linking = {
  prefixes: ['rumo://', 'rooms://', 'https://rumo.app', 'https://rooms.app'],
  config: {
    screens: {
      AuthCallback: 'auth-callback',
      ResetPassword: 'reset-password',
      Main: {
        screens: {
          Home: {
            screens: {
              Room: 'room/:roomId',
              JoinRoom: 'join/:roomId',
            },
          },
          Rooms: {
            screens: {
              Room: 'rooms/:roomId',
            },
          },
        },
      },
    },
  },
};

function RootNavigator() {
  const { isLoggedIn, hasOnboarded, hasNickname, storageReady } = useApp();
  const [splashDone, setSplashDone] = useState(false);

  // Keep splash visible until both the animation is done AND storage is hydrated
  if (!splashDone || !storageReady) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  return (
    <Root.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!hasOnboarded ? (
        <Root.Screen name="Onboarding" component={OnboardingScreen} />
      ) : !isLoggedIn ? (
        <Root.Screen name="Auth" component={AuthScreen} />
      ) : !hasNickname ? (
        <Root.Screen name="Nickname" component={NicknameScreen} />
      ) : (
        <Root.Screen name="Main" component={TabNavigator} />
      )}
      <Root.Screen name="AuthCallback" component={AuthCallbackScreen} />
      <Root.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Root.Navigator>
  );
}

// Обёртка нужна чтобы иметь доступ к useApp() внутри AppProvider
function ThemedApp() {
  const { themeMode } = useApp();
  const palette = getPalette(themeMode);
  const isDark = themeMode === 'dark';

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: palette.bg,   // ← главное: убирает белый фон везде
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme} linking={linking} ref={navigationRef}>
      <RootNavigator />
      <InAppNotificationBanner />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SafeAreaProvider>
        <ThemedApp />
      </SafeAreaProvider>
    </AppProvider>
  );
}
