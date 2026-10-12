import type { BabyEvent } from '@/db/types';

import { addLocalDays } from './dates';
import { summarizeDay, type DaySummary } from './day-summary';
import { recentWakeWindows } from './sleep-prediction';

export type DayInsight = DaySummary & {
  /** Local midnight. */
  dayStart: number;
  /** Longest single sleep that started this day. */
  longestSleepMs: number;
  /** Today: still in progress, so shown but left out of averages. */
  partial: boolean;
};

export type Insights = {
  days: DayInsight[];
  /** Averages over complete days that have any entries (so unlogged days don't drag them down). */
  averages: {
    sleepMs: number;
    longestSleepMs: number;
    feedCount: number;
    bottleMl: number;
    diaperCount: number;
    wetCount: number;
    dirtyCount: number;
    pumpMl: number;
  } | null;
  /** Median daytime awake stretch across the range. */
  typicalWakeWindowMs: number | null;
  loggedDays: number;
};

function hasEntries(day: DaySummary): boolean {
  return (
    day.sleepMs > 0 ||
    day.feedCount > 0 ||
    day.diaperCount > 0 ||
    day.pumpCount > 0 ||
    day.medicationCount > 0
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Per-day totals for the `dayCount` days ending today, plus averages.
 * `events` must cover the whole range (anything overlapping it).
 */
export function buildInsights(
  events: BabyEvent[],
  todayStart: number,
  dayCount: number,
  now: number,
): Insights {
  const days: DayInsight[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const dayStart = addLocalDays(todayStart, -i);
    const dayEnd = addLocalDays(dayStart, 1);
    const summary = summarizeDay(events, dayStart, dayEnd, now);
    const longestSleepMs = events.reduce((longest, e) => {
      if (e.type !== 'sleep' || e.startAt < dayStart || e.startAt >= dayEnd) return longest;
      return Math.max(longest, (e.endAt ?? now) - e.startAt);
    }, 0);
    days.push({ ...summary, dayStart, longestSleepMs, partial: dayStart === todayStart });
  }

  const complete = days.filter((d) => !d.partial && hasEntries(d));
  const avg = (pick: (d: DayInsight) => number) =>
    complete.reduce((sum, d) => sum + pick(d), 0) / complete.length;

  const sleeps = events.filter(
    (e): e is BabyEvent<'sleep'> => e.type === 'sleep' && e.startAt >= days[0].dayStart,
  );

  return {
    days,
    averages: complete.length
      ? {
          sleepMs: avg((d) => d.sleepMs),
          longestSleepMs: avg((d) => d.longestSleepMs),
          feedCount: avg((d) => d.feedCount),
          bottleMl: avg((d) => d.bottleMl),
          diaperCount: avg((d) => d.diaperCount),
          wetCount: avg((d) => d.wetCount),
          dirtyCount: avg((d) => d.dirtyCount),
          pumpMl: avg((d) => d.pumpMl),
        }
      : null,
    // recentWakeWindows looks back a week from `now`; widen it to the chosen range.
    typicalWakeWindowMs: median(recentWakeWindows(sleeps, now, now - days[0].dayStart)),
    loggedDays: complete.length,
  };
}
