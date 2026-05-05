import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { initializeCache } from '@/services/cacheService';
import { Buffer } from 'buffer';
import Logo from '@/components/Logo';
import { bgPrimary, bgSecondary } from '@/constants/colors';

// Polyfill Buffer for React Native
global.Buffer = Buffer;

// Ignore defaultProps warning from react-native-render-html
LogBox.ignoreLogs([
  'Support for defaultProps will be removed from function components',
]);

export default function RootLayout() {
  useEffect(() => {
    // Initialize cache on app startup
    initializeCache().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent={false} backgroundColor={bgSecondary} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: bgSecondary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: bgPrimary,
          },
          animation: 'slide_from_right',
          headerTransparent: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerTitle: () => <Logo width={40} height={40} />,
          }}
        />
        <Stack.Screen
          name="column/[name]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="page/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="config"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
