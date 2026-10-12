import type { BabyEvent, EventDataMap, EventType } from '@/db/types';

import { startBreast } from './breast';
import { addLocalDays, startOfLocalDay } from './dates';
import { summarizeDay } from './day-summary';

const MIN = 60_000;
const HOUR = 60 * MIN;

const dayStart = new Date(2026, 9, 11).getTime(); // Oct 11, 2026, local midnight
const dayEnd = addLocalDays(dayStart, 1);

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

describe('summarizeDay', () => {
  it('clips sleep that crosses midnight to the day', () => {
    const overnight = event('sleep', dayStart - 2 * HOUR, dayStart + 5 * HOUR, {});
    const nap = event('sleep', dayStart + 9 * HOUR, dayStart + 10 * HOUR, {});
    const summary = summarizeDay([overnight, nap], dayStart, dayEnd, dayEnd);
    expect(summary.sleepMs).toBe(6 * HOUR);
    expect(summary.sleepCount).toBe(1); // the overnight sleep started yesterday
  });

  it('counts a running sleep up to now', () => {
    const running = event('sleep', dayStart + 20 * HOUR, null, {});
    const summary = summarizeDay([running], dayStart, dayEnd, dayStart + 21 * HOUR + 30 * MIN);
    expect(summary.sleepMs).toBe(90 * MIN);
  });

  it('totals feeds and diapers that started in the day', () => {
    const events = [
      event('feed_bottle', dayStart + HOUR, null, { amountMl: 120, content: 'formula' }),
      event('feed_bottle', dayStart + 4 * HOUR, null, { amountMl: 90, content: 'breast_milk' }),
      event('feed_breast', dayStart + 6 * HOUR, null, startBreast('L', dayStart + 6 * HOUR)),
      event('feed_solids', dayStart + 8 * HOUR, null, { foods: ['banana'] }),
      event('diaper', dayStart + 2 * HOUR, null, { wet: true, dirty: false }),
      event('diaper', dayStart + 3 * HOUR, null, { wet: true, dirty: true }),
    ];
    const summary = summarizeDay(events, dayStart, dayEnd, dayStart + 6 * HOUR + 12 * MIN);
    expect(summary).toMatchObject({
      feedCount: 4,
      bottleMl: 210,
      breastMs: 12 * MIN,
      diaperCount: 2,
      wetCount: 2,
      dirtyCount: 1,
    });
  });
});

describe('day boundaries', () => {
  it('finds local midnight', () => {
    expect(startOfLocalDay(dayStart + 13 * HOUR)).toBe(dayStart);
  });

  it('steps whole calendar days, even across DST changes', () => {
    const nov1 = new Date(2026, 10, 1).getTime();
    expect(new Date(addLocalDays(nov1, 1)).getDate()).toBe(2);
    expect(new Date(addLocalDays(nov1, 1)).getHours()).toBe(0);
  });
});
