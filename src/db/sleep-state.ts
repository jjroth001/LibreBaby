import type { SQLiteDatabase } from 'expo-sqlite';

import { ageInDays } from '@/lib/dates';
import { predictNextSleep, recentWakeWindows, type SleepPrediction } from '@/lib/sleep-prediction';

import { listEvents } from './events';
import type { BabyEvent, Child } from './types';

const LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000;

export type SleepState =
  | { status: 'sleeping'; since: number }
  /** No finished sleep logged yet, so nothing to predict from. */
  | { status: 'no-data' }
  | { status: 'awake'; lastWokeAt: number; prediction: SleepPrediction };

/** Sleeps from the last ~week: enough for both "asleep now?" and personalized wake windows. */
export async function loadRecentSleeps(
  db: SQLiteDatabase,
  childId: string,
  now: number,
): Promise<BabyEvent<'sleep'>[]> {
  const events = await listEvents(db, childId, now - LOOKBACK_MS, now + 1);
  return events.filter((e): e is BabyEvent<'sleep'> => e.type === 'sleep');
}

/** Whether the baby is asleep and, if awake, when the next sleep window should be. */
export function sleepStateFrom(child: Child, sleeps: BabyEvent<'sleep'>[]): SleepState {
  const running = sleeps.find((s) => s.endAt === null);
  if (running) return { status: 'sleeping', since: running.startAt };

  const finished = sleeps.filter((s) => s.endAt !== null);
  if (finished.length === 0) return { status: 'no-data' };

  const lastWokeAt = Math.max(...finished.map((s) => s.endAt!));
  const prediction = predictNextSleep({
    ageDays: ageInDays(child.birthDate, new Date(lastWokeAt)),
    lastWokeAt,
    recentWindows: recentWakeWindows(finished, lastWokeAt),
  });
  return { status: 'awake', lastWokeAt, prediction };
}
