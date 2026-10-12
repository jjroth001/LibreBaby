import type { BabyEvent } from '@/db/types';

import { totalMs } from './breast';

export type DaySummary = {
  /** Time asleep within the day; sleeps crossing midnight count only their part. */
  sleepMs: number;
  /** Sleeps that started this day. */
  sleepCount: number;
  feedCount: number;
  bottleMl: number;
  breastMs: number;
  diaperCount: number;
  wetCount: number;
  dirtyCount: number;
};

/** Totals for the day [dayStart, dayEnd). Running timers count up to `now`. */
export function summarizeDay(
  events: BabyEvent[],
  dayStart: number,
  dayEnd: number,
  now: number,
): DaySummary {
  const summary: DaySummary = {
    sleepMs: 0,
    sleepCount: 0,
    feedCount: 0,
    bottleMl: 0,
    breastMs: 0,
    diaperCount: 0,
    wetCount: 0,
    dirtyCount: 0,
  };

  for (const event of events) {
    const startedToday = event.startAt >= dayStart && event.startAt < dayEnd;

    switch (event.type) {
      case 'sleep': {
        const from = Math.max(event.startAt, dayStart);
        const to = Math.min(event.endAt ?? now, dayEnd);
        summary.sleepMs += Math.max(0, to - from);
        if (startedToday) summary.sleepCount++;
        break;
      }
      case 'feed_breast':
        if (!startedToday) break;
        summary.feedCount++;
        summary.breastMs += totalMs(event.data, now);
        break;
      case 'feed_bottle':
        if (!startedToday) break;
        summary.feedCount++;
        summary.bottleMl += event.data.amountMl;
        break;
      case 'feed_solids':
        if (startedToday) summary.feedCount++;
        break;
      case 'diaper':
        if (!startedToday) break;
        summary.diaperCount++;
        if (event.data.wet) summary.wetCount++;
        if (event.data.dirty) summary.dirtyCount++;
        break;
    }
  }

  return summary;
}
