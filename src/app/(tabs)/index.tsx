import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LastEvents } from '@/components/home/last-events';
import { QuickLog } from '@/components/home/quick-log';
import { RunningBreastCard } from '@/components/home/running-breast-card';
import { RunningSleepCard } from '@/components/home/running-sleep-card';
import { UndoBanner } from '@/components/home/undo-banner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteEvent, getLatestEvent, insertEvent, listRunningTimers, startTimer } from '@/db/events';
import type { BabyEvent, Child, EventDataMap } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useNow } from '@/hooks/use-now';
import { startBreast, suggestedNextSide } from '@/lib/breast';
import { formatAge } from '@/lib/dates';
import { describeEvent } from '@/lib/describe';
import { successFeedback, tapFeedback } from '@/lib/haptics';

const FEED_TYPES = ['feed_breast', 'feed_bottle', 'feed_solids'] as const;

export default function HomeScreen() {
  const { data: child } = useChild();
  if (!child) return null;
  return <Home child={child} />;
}

function Home({ child }: { child: Child }) {
  const db = useSQLiteContext();
  const settings = useSettings();
  const running = useDbQuery(['event'], (db) => listRunningTimers(db, child.id), [child.id]);
  const latest = useDbQuery(
    ['event'],
    async (db) => {
      const [sleep, feed, diaper, breast] = await Promise.all([
        getLatestEvent(db, child.id, ['sleep']),
        getLatestEvent(db, child.id, FEED_TYPES),
        getLatestEvent(db, child.id, ['diaper']),
        getLatestEvent(db, child.id, ['feed_breast']),
      ]);
      return { sleep, feed, diaper, breast };
    },
    [child.id],
  );
  const [undo, setUndo] = useState<{ eventId: string; message: string } | null>(null);

  const runningSleep = running.data?.find((e): e is BabyEvent<'sleep'> => e.type === 'sleep');
  const runningBreast = running.data?.find((e): e is BabyEvent<'feed_breast'> => e.type === 'feed_breast');
  // Tick every second while a timer is on screen; otherwise "x ago" only needs minute precision.
  const now = useNow(runningSleep || runningBreast ? 1000 : 30_000);

  if (settings.status !== 'success' || running.status !== 'success' || latest.status !== 'success') {
    return null;
  }
  const unit = settings.data.volumeUnit;
  const nextSide = suggestedNextSide(latest.data.breast?.data);

  const startSleep = async () => {
    tapFeedback();
    await startTimer(db, { childId: child.id, type: 'sleep', startAt: Date.now(), data: {} });
  };

  const startBreastFeed = async () => {
    tapFeedback();
    const startAt = Date.now();
    await startTimer(db, {
      childId: child.id,
      type: 'feed_breast',
      startAt,
      data: startBreast(nextSide, startAt),
    });
  };

  const logDiaper = async (data: EventDataMap['diaper']) => {
    const event = await insertEvent(db, { childId: child.id, type: 'diaper', startAt: Date.now(), data });
    successFeedback();
    setUndo({ eventId: event.id, message: `${describeEvent(event, unit)} logged` });
  };

  const actions = [
    ...(runningSleep ? [] : [{ key: 'sleep', emoji: '😴', label: 'Sleep', detail: 'Start timer', onPress: startSleep }]),
    ...(runningBreast
      ? []
      : [
          {
            key: 'breast',
            emoji: '🤱',
            label: 'Breast',
            detail: `Start ${nextSide === 'L' ? 'left' : 'right'}`,
            onPress: startBreastFeed,
          },
        ]),
    { key: 'bottle', emoji: '🍼', label: 'Bottle', onPress: () => router.push('/log/bottle') },
    { key: 'solids', emoji: '🥣', label: 'Solids', onPress: () => router.push('/log/solids') },
    { key: 'wet', emoji: '💧', label: 'Wet', onPress: () => logDiaper({ wet: true, dirty: false }) },
    { key: 'dirty', emoji: '💩', label: 'Dirty', onPress: () => logDiaper({ wet: false, dirty: true }) },
    { key: 'both', emoji: '💧💩', label: 'Both', onPress: () => logDiaper({ wet: true, dirty: true }) },
    { key: 'past-sleep', emoji: '🕘', label: 'Past sleep', onPress: () => router.push('/log/sleep') },
  ];

  return (
    <ThemedView style={styles.fill}>
      <Screen>
        <View style={styles.header}>
          <ThemedText type="subtitle">{child.name}</ThemedText>
          <ThemedText themeColor="textSecondary">{formatAge(child.birthDate)} old</ThemedText>
        </View>

        {runningSleep && <RunningSleepCard event={runningSleep} now={now} />}
        {runningBreast && <RunningBreastCard event={runningBreast} now={now} />}

        <LastEvents
          now={now}
          unit={unit}
          sleeping={!!runningSleep}
          lastSleep={latest.data.sleep}
          lastFeed={latest.data.feed}
          lastDiaper={latest.data.diaper}
        />

        <QuickLog actions={actions} />
      </Screen>

      {undo && (
        <UndoBanner
          key={undo.eventId}
          message={undo.message}
          onDismiss={() => setUndo(null)}
          onUndo={async () => {
            setUndo(null);
            await deleteEvent(db, undo.eventId);
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: Spacing.one },
});
