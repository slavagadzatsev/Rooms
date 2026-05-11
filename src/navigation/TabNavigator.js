import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen          from '../screens/HomeScreen';
import RoomScreen          from '../screens/RoomScreen';
import CreateRoomScreen    from '../screens/CreateRoomScreen';
import RoomsScreen         from '../screens/RoomsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen       from '../screens/ProfileScreen';
import EditProfileScreen   from '../screens/EditProfileScreen';
import { useApp }          from '../context/AppContext';
import { haptics }         from '../hooks/useHaptics';
import { colors, getPalette } from '../theme';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Home:          { active: 'home',              inactive: 'home-outline' },
  Rooms:         { active: 'chatbubbles',       inactive: 'chatbubbles-outline' },
  Notifications: { active: 'notifications',     inactive: 'notifications-outline' },
  Profile:       { active: 'person-circle',     inactive: 'person-circle-outline' },
};

const STACK_DEFAULTS = {
  headerShown: false,
  gestureEnabled: true,
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={STACK_DEFAULTS}>
      <Stack.Screen name="HomeMain"   component={HomeScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Room"       component={RoomScreen} />
      <Stack.Screen name="JoinRoom"   component={RoomScreen} />
      <Stack.Screen name="CreateRoom" component={CreateRoomScreen} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom', animationDuration: 380 }} />
    </Stack.Navigator>
  );
}

function RoomsStack() {
  return (
    <Stack.Navigator screenOptions={STACK_DEFAULTS}>
      <Stack.Screen name="RoomsMain" component={RoomsScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="Room"      component={RoomScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={STACK_DEFAULTS}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  const { themeMode, totalUnread, unreadNotifCount } = useApp();
  const palette = getPalette(themeMode);
  const isDark  = palette.isDark;
  const { width } = useWindowDimensions();

  // Compact pill: 4 icons × 44px + 16px padding
  const TAB_BAR_WIDTH = Math.min(245, width - 70);

  return (
    <Tab.Navigator
      id="RootTabs"
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   isDark ? '#ffffff' : '#111827',
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.58)' : 'rgba(17,24,39,0.58)',

        tabBarBackground: () => (
          <View style={[
            styles.tabBarBg,
            { backgroundColor: isDark ? 'rgba(14,11,30,0.78)' : 'rgba(255,255,255,0.70)' },
          ]}>
            <BlurView
              intensity={isDark ? 60 : 75}
              tint={isDark ? 'dark' : 'extraLight'}
              style={StyleSheet.absoluteFill}
            />
            <View style={[
              styles.tabBarBorder,
              { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.13)' },
            ]} />
          </View>
        ),

        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          marginHorizontal: (width - TAB_BAR_WIDTH) / 2,
          width: TAB_BAR_WIDTH,
          height: 60,
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 4,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 30,
          overflow: 'hidden',
          shadowColor:   isDark ? '#000' : colors.purple,
          shadowOpacity: isDark ? 0.55 : 0.18,
          shadowRadius:  24,
          shadowOffset:  { width: 0, height: 8 },
          elevation: 14,
        },

        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 0,
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarShowLabel: false,
        tabBarBadgeStyle: {
          backgroundColor: colors.purple,
          fontSize: 9,
          minWidth: 16,
          height: 16,
          lineHeight: 16,
        },

        tabBarIcon: ({ focused, color }) => {
          const iconSet = TAB_ICONS[route.name];
          const iconName = focused ? iconSet.active : iconSet.inactive;
          return (
            <View style={[
              styles.iconBox,
              focused && {
                backgroundColor: isDark
                  ? 'rgba(107, 92, 231, 0.22)'
                  : 'rgba(17, 24, 39, 0.08)',
              },
            ]}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home"          component={HomeStack}          listeners={{ tabPress: () => haptics.select() }} />
      <Tab.Screen name="Rooms"         component={RoomsStack}         listeners={{ tabPress: () => haptics.select() }} options={{ tabBarBadge: totalUnread > 0 ? totalUnread : undefined }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} listeners={{ tabPress: () => haptics.select() }} options={{ tabBarBadge: unreadNotifCount > 0 ? unreadNotifCount : undefined }} />
      <Tab.Screen name="Profile"       component={ProfileStack}       listeners={{ tabPress: () => haptics.select() }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarBg: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  tabBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
