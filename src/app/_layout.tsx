import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { migrateDbIfNeeded } from '@/db/migrations';
import { useChild } from '@/db/use-child';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={null}>
        <SQLiteProvider
          databaseName="librebaby.db"
          options={{ enableChangeListener: true }}
          onInit={migrateDbIfNeeded}
          useSuspense>
          <RootNavigator />
        </SQLiteProvider>
      </Suspense>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}

/** Until a child profile exists, only onboarding is reachable; afterwards, only the tabs. */
function RootNavigator() {
  const child = useChild();
  if (child.status === 'loading') return null;
  const hasChild = child.data != null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={hasChild}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!hasChild}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}
