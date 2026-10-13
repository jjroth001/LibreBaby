import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect } from 'react';

import { SkyProvider, useSky } from '@/components/sky/sky-provider';
import { TimerNotificationSync } from '@/components/timer-notification-sync';
import { migrateDbIfNeeded } from '@/db/migrations';
import { useChild } from '@/db/use-child';
import { useTheme } from '@/hooks/use-theme';
import { SyncProvider } from '@/sync/sync-provider';
import { WidgetSync } from '@/widget/widget-sync';

// Keep the moon splash up until the database is open and we know which screen to show,
// then let Android fade it out.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  return (
    <Suspense fallback={null}>
      <SQLiteProvider
        databaseName="librebaby.db"
        options={{ enableChangeListener: true }}
        onInit={migrateDbIfNeeded}
        useSuspense>
        <SkyProvider>
          <RootNavigator />
        </SkyProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

// Log and edit forms rise in over the same sky (screens are transparent, so a full slide
// would show both screens' panels overlapping).
const logSheet = {
  presentation: 'modal',
  animation: 'fade_from_bottom',
  headerShown: true,
} as const;

/** Until a child profile exists, only onboarding is reachable; afterwards, only the tabs. */
function RootNavigator() {
  const theme = useTheme();
  const { scene, ready: skyReady } = useSky();
  const child = useChild();
  const ready = child.status !== 'loading' && skyReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // The native window shows at the very edges during transitions; match the horizon.
  const windowColor = theme.simple ? theme.background : scene.hills[2];
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(windowColor).catch(() => {});
  }, [windowColor]);

  if (!ready) return null;
  const hasChild = child.data != null;

  const base = theme.light ? DefaultTheme : DarkTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: 'transparent',
      card: 'transparent',
      border: 'transparent',
      text: theme.text,
      primary: theme.tint,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.light ? 'dark' : 'light'} />
      {/* At the root (not in the tabs) so it also resets the widget after an erase. */}
      <WidgetSync />
      <TimerNotificationSync />
      <SyncProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTintColor: theme.text,
          }}>
          <Stack.Protected guard={hasChild}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="log/sleep" options={{ ...logSheet, title: 'Log sleep' }} />
            <Stack.Screen name="log/breast" options={{ ...logSheet, title: 'Log breastfeed' }} />
            <Stack.Screen name="log/bottle" options={{ ...logSheet, title: 'Log bottle' }} />
            <Stack.Screen name="log/solids" options={{ ...logSheet, title: 'Log solids' }} />
            <Stack.Screen name="log/diaper" options={{ ...logSheet, title: 'Log diaper' }} />
            <Stack.Screen name="log/pump" options={{ ...logSheet, title: 'Log pumping' }} />
            <Stack.Screen
              name="log/medication"
              options={{ ...logSheet, title: 'Log medication' }}
            />
            <Stack.Screen name="log/growth" options={{ ...logSheet, title: 'Log measurement' }} />
            <Stack.Screen name="event/[id]" options={{ ...logSheet, title: 'Edit' }} />
            <Stack.Screen name="erase" options={{ ...logSheet, title: 'Erase all data' }} />
            <Stack.Screen name="sync/pair" options={{ ...logSheet, title: 'Family code' }} />
          </Stack.Protected>
          <Stack.Protected guard={!hasChild}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          {/* Reachable from Settings and from the welcome screen (joining a family). */}
          <Stack.Screen name="sync/join" options={{ ...logSheet, title: 'Join a family' }} />
        </Stack>
      </SyncProvider>
    </ThemeProvider>
  );
}
