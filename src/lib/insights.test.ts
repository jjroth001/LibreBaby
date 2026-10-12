import type { BabyEvent, EventDataMap, EventType } from '@/db/types';

import { addLocalDays } from './dates';
import { buildInsights } from './insights';

const MIN = 60_000;
const HOUR = 60 * MIN;

const today = new Date(2026, 9, 11).getTime(); // Oct 11, 2026
const day = (offset: number, hour = 0, minute = 0) =>
  addLocalDays(today, offset) + hour * HOUR + minute * MIN;

let nextId = 0;
function event<T extends EventType>(
  type: T,
  startAt: number,
  endAt: number | null,
  data: EventDataMap[T],
): BabyEvent<T> {
  return {
    id: String(nextId++),
    childId: 'c',
    type,
    startAt,
    endAt,
    data,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  } as BabyEvent<T>;
}

describe('buildInsights', () => {
  const events = [
    // Two days ago: 10h night (from the evening before) + 2h of naps.
    event('sleep', day(-3, 20), day(-2, 6), {}),
    event('sleep', day(-2, 9), day(-2, 10), {}),
    event('sleep', day(-2, 13), day(-2, 14), {}),
    event('diaper', day(-2, 8), null, { wet: true, dirty: false }),
    // Yesterday: one 3h nap, 2 bottles.
    event('sleep', day(-1, 12), day(-1, 15), {}),
    event('feed_bottle', day(-1, 8), null, { amountMl: 120, content: 'formula' }),
    event('feed_bottle', day(-1, 16), null, { amountMl: 90, content: 'formula' }),
    // Today (partial): a bottle that must not count toward averages.
    event('feed_bottle', day(0, 7), null, { amountMl: 500, content: 'formula' }),
  ];
  const insights = buildInsights(events, today, 7, day(0, 9));

  it('returns one entry per day, oldest first, with today marked partial', () => {
    expect(insights.days).toHaveLength(7);
    expect(insights.days[0].dayStart).toBe(day(-6));
    expect(insights.days[6]).toMatchObject({ dayStart: today, partial: true, bottleMl: 500 });
  });

  it('averages only complete days that have entries', () => {
    // Logged complete days: 3 days ago (4h, the start of the overnight sleep),
    // two days ago (6h + 2h) and yesterday (3h). Empty days and today don't count.
    expect(insights.loggedDays).toBe(3);
    expect(insights.averages?.sleepMs).toBe(5 * HOUR);
    expect(insights.averages?.bottleMl).toBe(70);
    expect(insights.averages?.feedCount).toBeCloseTo(2 / 3);
  });

  it('tracks the longest sleep that started each day', () => {
    // The 10h overnight started 3 days ago, so two days ago's longest is a 1h nap.
    expect(insights.days[4].longestSleepMs).toBe(HOUR);
    expect(insights.days[5].longestSleepMs).toBe(3 * HOUR);
  });

  it('has no averages when nothing has been logged', () => {
    expect(buildInsights([], today, 7, day(0, 9)).averages).toBeNull();
  });
});
