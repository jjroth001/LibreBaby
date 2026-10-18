import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import AppTabs from '@/components/app-tabs';
import { MedReminderSync } from '@/components/med-reminder-sync';
import { SleepReminderSync } from '@/components/sleep-reminder-sync';
import { useChild } from '@/db/use-child';

/** About as long as a page takes to rise in (Android's fade-from-bottom). */
const COVER_FADE_MS = 200;

export default function TabsLayout() {
  const { data: child } = useChild();
  // Screens are see-through so the sky shows behind them. While a page or log form rises
  // in over the tabs, fade the tabs (and their bar) out, and back in on the way back, so
  // the two cross-fade instead of both showing at once.
  const covered = !useIsFocused();
  const opacity = useSharedValue(covered ? 0 : 1);
  useEffect(() => {
    opacity.value = withTiming(covered ? 0 : 1, { duration: COVER_FADE_MS });
  }, [covered, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <>
      {child && <SleepReminderSync child={child} />}
      {child && <MedReminderSync child={child} />}
      <Animated.View style={[styles.fill, fade]}>
        <AppTabs />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
