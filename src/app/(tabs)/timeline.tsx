import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { DayPicker } from '@/components/timeline/day-picker';
import { DayTotals } from '@/components/timeline/day-totals';
import { EventRow } from '@/components/timeline/event-row';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { listEvents, TIMER_TYPES } from '@/db/events';
import type { BabyEvent, Child } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useLiveLayout } from '@/hooks/use-live-layout';
import { useNow } from '@/hooks/use-now';
import { addLocalDays, startOfLocalDay } from '@/lib/dates';
import { summarizeDay } from '@/lib/day-summary';

function isRunning(event: BabyEvent): boolean {
  return event.endAt === null && (TIMER_TYPES as readonly string[]).includes(event.type);
}

export default function TimelineScreen() {
  const { data: child } = useChild();
  if (!child) return null;
  return <Timeline child={child} />;
}

function Timeline({ child }: { child: Child }) {
  const settings = useSettings();
  const now = useNow(60_000);
  const { layout, resetKey } = useLiveLayout();
  const today = startOfLocalDay(now);
  const [day, setDay] = useState(today);
  const dayEnd = addLocalDays(day, 1);
  const events = useDbQuery(['event'], (db) => listEvents(db, child.id, day, dayEnd), [
    child.id,
    day,
    dayEnd,
  ]);

  if (settings.status !== 'success' || events.status !== 'success') return null;
  const unit = settings.data.volumeUnit;
  const summary = summarizeDay(events.data, day, dayEnd, now);
  // Newest first: the most recent entries are the ones you usually want to check or fix.
  const newestFirst = [...events.data].reverse();

  return (
    <Screen>
      <DayPicker day={day} today={today} onChange={setDay} />
      <DayTotals summary={summary} unit={unit} />

      {newestFirst.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing logged {day === today ? 'yet today' : 'this day'}.
          </ThemedText>
        </Card>
      ) : (
        // One glass panel for the whole day (one blur, not one per row). Keyed by day so
        // changing days cross-fades the list; rows glide when one is removed.
        <Card style={styles.card}>
          <LayoutAnimationConfig key={resetKey} skipEntering skipExiting>
            <Animated.View key={day} entering={Motion.fadeIn} style={styles.list}>
              {newestFirst.map((event) => {
                const running = isRunning(event);
                return (
                  <Animated.View key={event.id} exiting={Motion.exit} layout={layout}>
                    <EventRow
                      event={event}
                      unit={unit}
                      growthUnits={settings.data.growthUnits}
                      dayStart={day}
                      running={running}
                      onPress={() =>
                        running
                          ? router.navigate('/')
                          : router.push({ pathname: '/event/[id]', params: { id: event.id } })
                      }
                    />
                  </Animated.View>
                );
              })}
            </Animated.View>
          </LayoutAnimationConfig>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.two },
  list: { gap: Spacing.half },
  empty: { textAlign: 'center' },
});
