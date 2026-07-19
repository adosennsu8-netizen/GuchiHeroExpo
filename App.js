// App.js
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { registerRootComponent } from 'expo';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { getDatabase, ref, set } from 'firebase/database';
import { useEffect } from 'react';
import { Platform, Text } from 'react-native';

import CountdownScreen from './src/screens/CountdownScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StageScreen from './src/screens/StageScreen';
import VoiceSelectScreen from './src/screens/VoiceSelectScreen';
import WaitingScreen from './src/screens/WaitingScreen';
import WallScreen from './src/screens/WallScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Web版の静的書き出し（expo export -p web）では、開発サーバーと違い
// html/body/#root に高さ100%のリセットが自動で当たらず、
// flex:1のレイアウトが縮んで表示されるため、Web限定で明示的に指定する
function injectWebHeightFix() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('web-height-fix')) return;

  const style = document.createElement('style');
  style.id = 'web-height-fix';
  style.innerHTML = `
    html, body, #root {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    #root {
      display: flex;
      flex-direction: column;
    }
  `;
  document.head.appendChild(style);

  // Chromeの自動翻訳がボタン文言等を誤訳するのを防ぐ
  document.documentElement.setAttribute('translate', 'no');
  if (!document.querySelector('meta[name="google"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }

  // 安全領域(ホームバー等)の自動検出を有効にする。
  // これが無いと env(safe-area-inset-bottom) 等が常に0扱いになり、
  // React Navigationのタブバーが持つ安全領域の自動回避が機能しない
  const existingViewport = document.querySelector('meta[name="viewport"]');
  if (existingViewport) {
    if (!existingViewport.content.includes('viewport-fit=cover')) {
      existingViewport.content = `${existingViewport.content}, viewport-fit=cover`;
    }
  } else {
    const viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
    document.head.appendChild(viewportMeta);
  }
}

async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  const db = getDatabase();
  const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await set(ref(db, `fcmTokens/${sessionId}`), {
    token,
    platform: Platform.OS,
    createdAt: Date.now(),
  });

  return token;
}

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
  useEffect(() => {
    injectWebHeightFix();
    registerForPushNotifications().catch(console.error);
  }, []);

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
