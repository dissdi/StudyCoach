import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import type { RootStackParamList, MainTabParamList } from '@/types';
import { COLORS } from '@/constants';

// Screens
import HomeScreen from '@/screens/HomeScreen';
import StudySessionScreen from '@/screens/StudySessionScreen';
import ReportScreen from '@/screens/ReportScreen';
import StatsScreen from '@/screens/StatsScreen';
import SettingsScreen from '@/screens/SettingsScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Stats: '📊',
    Settings: '⚙️',
  };
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>
      {icons[name]}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarLabel: ({ focused }) => (
          <Text
            style={{
              fontSize: 10,
              color: focused ? COLORS.primary : COLORS.textMuted,
              marginBottom: 4,
            }}
          >
            {route.name === 'Home' ? '홈' : route.name === 'Stats' ? '통계' : '설정'}
          </Text>
        ),
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Session"
          component={StudySessionScreen}
          options={{ presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="Report"
          component={ReportScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
    height: 72,
    backgroundColor: 'transparent',
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.bgElevated,
  },
});
