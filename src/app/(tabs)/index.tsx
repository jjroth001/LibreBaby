import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Action } from '@/components/home/action-grid';
import { LastEvents } from '@/components/home/last-events';
import { LogMenu, type Category } from '@/components/home/log-menu';
import { RunningBreastCard } from '@/components/home/running-breast-card';
import { RunningSleepCard } from '@/components/home/running-sleep-card';
import { SleepWindowCard } from '@/components/home/sleep-window-card';
import { UndoBanner } from '@/components/home/undo-banner';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  deleteEvent,
  getLatestEvent,
  insertEventNow,
  listRecentMedications,
  listRunningTimers,
  startTimer,
  type RecentMedication,
} from '@/db/events';
import type { BabyEvent, BreastSide, Child, EventDataMap } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useNow } from '@/hooks/use-now';
import { useSleepPrediction } from '@/hooks/use-sleep-prediction';
import { startBreast } from '@/lib/breast';
import { formatAge } from '@/lib/dates';
import { describeEvent } from '@/lib/describe';
import { formatDuration } from '@/lib/format';
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
  const recentMeds = useDbQuery(['event'], (db) => listRecentMedications(db, child.id, 3), [
    child.id,
  ]);
  const sleepState = useSleepPrediction(child);
  const [openMenu, setOpenMenu] = useState<Category | null>(null);
  // The log menu is the last thing on Home, so when a submenu opens we scroll to the
  // bottom to bring its options into view — once they've been laid out.
  const scrollRef = useRef<ScrollView>(null);
  const revealMenu = useRef(false);
  const [undo, setUndo] = useState<{ eventId: string; message: string } | null>(null);

  const runningSleep = running.data?.find((e): e is BabyEvent<'sleep'> => e.type === 'sleep');
  const runningBreast = running.data?.find(
    (e): e is BabyEvent<'feed_breast'> => e.type === 'feed_breast',
  );
  // Tick every second while a timer is on screen; otherwise "x ago" only needs minute precision.
  const now = useNow(runningSleep || runningBreast ? 1000 : 30_000);

  if (
    settings.status !== 'success' ||
    running.status !== 'success' ||
    latest.status !== 'success' ||
    recentMeds.status !== 'success'
  ) {
    return null;
  }
  const unit = settings.data.volumeUnit;
  const lastSide = latest.data.breast?.data.lastSide;

  const startSleep = async () => {
    tapFeedback();
    await startTimer(db, { childId: child.id, type: 'sleep', startAt: Date.now(), data: {} });
  };

  const startBreastFeed = async (side: BreastSide) => {
    tapFeedback();
    const startAt = Date.now();
    await startTimer(db, {
      childId: child.id,
      type: 'feed_breast',
      startAt,
      data: startBreast(side, startAt),
    });
  };

  const logDiaper = async (data: EventDataMap['diaper']) => {
    const event = await insertEventNow(db, { childId: child.id, type: 'diaper', data });
    successFeedback();
    setUndo({ eventId: event.id, message: `${describeEvent(event, unit)} logged` });
  };

  const logMedication = async (med: RecentMedication) => {
    const event = await insertEventNow(db, {
      childId: child.id,
      type: 'medication',
      data: { name: med.name, dose: med.dose },
    });
    successFeedback();
    setUndo({ eventId: event.id, message: `${describeEvent(event, unit)} logged` });
  };

  const actions: Record<Category, Action[]> = {
    sleep: [
      ...(runningSleep
        ? []
        : [{ key: 'start', emoji: '⏱️', label: 'Start timer', onPress: startSleep }]),
      {
        key: 'manual',
        emoji: '✏️',
        label: 'Enter manually',
        onPress: () => router.push('/log/sleep'),
      },
    ],
    feed: [
      // Both sides are offered; the parent picks. We only point out which side was used last.
      ...(runningBreast
        ? []
        : [
            {
              key: 'breast-left',
              emoji: '🤱',
              label: 'Left',
              detail: lastSide === 'L' ? 'Last side' : 'Start timer',
              onPress: () => startBreastFeed('L'),
            },
            {
              key: 'breast-right',
              emoji: '🤱',
              label: 'Right',
              detail: lastSide === 'R' ? 'Last side' : 'Start timer',
              onPress: () => startBreastFeed('R'),
            },
          ]),
      {
        key: 'bottle',
        emoji: '🍼',
        label: 'Bottle',
        onPress: () => router.push('/log/bottle'),
      },
      {
        key: 'solids',
        emoji: '🥣',
        label: 'Solids',
        onPress: () => router.push('/log/solids'),
      },
      {
        key: 'pump',
        emoji: '🥛',
        label: 'Pump',
        detail: 'Amount per side',
        onPress: () => router.push('/log/pump'),
      },
      {
        key: 'breast-manual',
        emoji: '✏️',
        label: 'Past breastfeed',
        detail: 'Enter manually',
        onPress: () => router.push('/log/breast'),
      },
    ],
    diaper: [
      {
        key: 'wet',
        emoji: '💧',
        label: 'Wet',
        detail: 'Log now',
        onPress: () => logDiaper({ wet: true, dirty: false }),
      },
      {
        key: 'dirty',
        emoji: '💩',
        label: 'Dirty',
        detail: 'Log now',
        onPress: () => logDiaper({ wet: false, dirty: true }),
      },
      {
        key: 'both',
        emoji: '💧💩',
        label: 'Both',
        detail: 'Log now',
        onPress: () => logDiaper({ wet: true, dirty: true }),
      },
      {
        key: 'manual',
        emoji: '✏️',
        label: 'Enter manually',
        onPress: () => router.push('/log/diaper'),
      },
    ],
    meds: [
      // Recently given medications log in one tap; showing when each was last given
      // helps avoid an accidental early repeat dose.
      ...recentMeds.data.map((med) => ({
        key: `med-${med.name}|${med.dose}`,
        emoji: '💊',
        label: med.dose ? `${med.name} · ${med.dose}` : med.name,
        detail: `Last ${formatDuration(now - med.lastGivenAt)} ago`,
        onPress: () => logMedication(med),
      })),
      {
        key: 'med-other',
        emoji: '✏️',
        label: recentMeds.data.length ? 'Other / enter manually' : 'Log medication',
        onPress: () => router.push('/log/medication'),
      },
    ],
  };

  return (
    <ThemedView style={styles.fill}>
      <Screen
        ref={scrollRef}
        onContentSizeChange={() => {
          if (!revealMenu.current) return;
          revealMenu.current = false;
          scrollRef.current?.scrollToEnd({ animated: true });
        }}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{child.name}</ThemedText>
          <ThemedText themeColor="textSecondary">{formatAge(child.birthDate)} old</ThemedText>
        </View>

        {runningSleep && <RunningSleepCard event={runningSleep} now={now} />}
        {runningBreast && <RunningBreastCard event={runningBreast} now={now} />}

        <SleepWindowCard state={sleepState} now={now} childName={child.name} />

        <LastEvents
          now={now}
          unit={unit}
          sleeping={!!runningSleep}
          lastSleep={latest.data.sleep}
          lastFeed={latest.data.feed}
          lastDiaper={latest.data.diaper}
        />

        <LogMenu
          open={openMenu}
          onToggle={(category) => {
            const opening = openMenu !== category;
            revealMenu.current = opening;
            // Switching between two open submenus of equal height won't change the
            // content size, so also scroll right away in that case.
            if (opening && openMenu !== null) scrollRef.current?.scrollToEnd({ animated: true });
            setOpenMenu(opening ? category : null);
          }}
          onClose={() => {
            revealMenu.current = false;
            setOpenMenu(null);
          }}
          actions={actions}
        />
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
