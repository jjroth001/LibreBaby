import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect } from 'react';

import { migrateDbIfNeeded } from '@/db/migrations';
import { useChild } from '@/db/use-child';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Keep the moon splash up until the database is open and we know which screen to show,
// then let Android fade it out.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const theme = useTheme();

  // The native window sits behind every screen and shows through during transitions;
  // Android defaults it to white, which flashes at the edges in dark mode.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  const base = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      primary: theme.tint,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Suspense fallback={null}>
        <SQLiteProvider
          databaseName="librebaby.db"
          options={{ enableChangeListener: true }}
          onInit={migrateDbIfNeeded}
          useSuspense>
          <RootNavigator />
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

// Log and edit forms slide up like a sheet, rather than Android's default transition.
const logSheet = {
  presentation: 'modal',
  animation: 'slide_from_bottom',
  headerShown: true,
} as const;

/** Until a child profile exists, only onboarding is reachable; afterwards, only the tabs. */
function RootNavigator() {
  const theme = useTheme();
  const child = useChild();
  const ready = child.status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  const hasChild = child.data != null;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Protected guard={hasChild}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="log/sleep" options={{ ...logSheet, title: 'Log sleep' }} />
        <Stack.Screen name="log/breast" options={{ ...logSheet, title: 'Log breastfeed' }} />
        <Stack.Screen name="log/bottle" options={{ ...logSheet, title: 'Log bottle' }} />
        <Stack.Screen name="log/solids" options={{ ...logSheet, title: 'Log solids' }} />
        <Stack.Screen name="log/diaper" options={{ ...logSheet, title: 'Log diaper' }} />
        <Stack.Screen name="log/pump" options={{ ...logSheet, title: 'Log pumping' }} />
        <Stack.Screen name="log/medication" options={{ ...logSheet, title: 'Log medication' }} />
        <Stack.Screen name="log/growth" options={{ ...logSheet, title: 'Log measurement' }} />
        <Stack.Screen name="event/[id]" options={{ ...logSheet, title: 'Edit' }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasChild}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
