import {
  loadRecentSleeps,
  sleepStateFrom,
  type SleepState as LoadedSleepState,
} from '@/db/sleep-state';
import type { Child } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';

export type SleepState = { status: 'loading' } | LoadedSleepState;

/** Whether the baby is asleep and, if awake, when the next sleep window should be. Live. */
export function useSleepPrediction(child: Child): SleepState {
  const sleeps = useDbQuery(['event'], (db) => loadRecentSleeps(db, child.id, Date.now()), [
    child.id,
  ]);
  if (sleeps.status !== 'success') return { status: 'loading' };
  return sleepStateFrom(child, sleeps.data);
}
