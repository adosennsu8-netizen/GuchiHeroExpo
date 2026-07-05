// App.js
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { registerRootComponent } from 'expo';
import CountdownScreen from './src/screens/CountdownScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StageScreen from './src/screens/StageScreen';
import VoiceSelectScreen from './src/screens/VoiceSelectScreen';
import WaitingScreen from './src/screens/WaitingScreen';
import WallScreen from './src/screens/WallScreen';
const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function StageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main"        component={StageScreen} />
      <Stack.Screen name="VoiceSelect" component={VoiceSelectScreen} />
      <Stack.Screen name="Waiting"     component={WaitingScreen} />
      <Stack.Screen name="Countdown"   component={CountdownScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a1a',
            borderTopWidth: 0.5,
            borderTopColor: '#333',
          },
          tabBarActiveTintColor: '#6b1a2a',
          tabBarInactiveTintColor: '#888',
          tabBarLabelStyle: { fontSize: 11 },
        }}
      >
        <Tab.Screen
  name="StageTab"
  component={StageStack}
  options={{
    tabBarLabel: 'ステージ',
    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🎭</Text>,
  }}
/>
        <Tab.Screen
  name="Wall"
  component={WallScreen}
  options={{
    tabBarLabel: '壁書き',
    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>✍️</Text>,
  }}
/>
<Tab.Screen
  name="Settings"
  component={SettingsScreen}
  options={{
    tabBarLabel: '設定',
    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
  }}
/>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
registerRootComponent(App);