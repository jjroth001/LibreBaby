import { listEvents } from '@/db/events';
import type { BabyEvent, Child } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { ageInDays } from '@/lib/dates';
import { predictNextSleep, recentWakeWindows, type SleepPrediction } from '@/lib/sleep-prediction';

const LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000;

export type SleepState =
  | { status: 'loading' }
  | { status: 'sleeping' }
  /** No finished sleep logged yet, so nothing to predict from. */
  | { status: 'no-data' }
  | { status: 'awake'; lastWokeAt: number; prediction: SleepPrediction };

/** Whether the baby is asleep and, if awake, when the next sleep window should be. */
export function useSleepPrediction(child: Child): SleepState {
  const sleeps = useDbQuery(
    ['event'],
    async (db) => {
      const now = Date.now();
      const events = await listEvents(db, child.id, now - LOOKBACK_MS, now + 1);
      return events.filter((e): e is BabyEvent<'sleep'> => e.type === 'sleep');
    },
    [child.id],
  );

  if (sleeps.status !== 'success') return { status: 'loading' };
  if (sleeps.data.some((s) => s.endAt === null)) return { status: 'sleeping' };

  const finished = sleeps.data.filter((s) => s.endAt !== null);
  if (finished.length === 0) return { status: 'no-data' };

  const lastWokeAt = Math.max(...finished.map((s) => s.endAt!));
  const prediction = predictNextSleep({
    ageDays: ageInDays(child.birthDate, new Date(lastWokeAt)),
    lastWokeAt,
    recentWindows: recentWakeWindows(finished, lastWokeAt),
  });
  return { status: 'awake', lastWokeAt, prediction };
}
