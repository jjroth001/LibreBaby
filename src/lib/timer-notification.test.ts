import type { BabyEvent } from '@/db/types';

import { timerNotification } from './timer-notification';

const MIN = 60_000;
const now = new Date(2026, 9, 12, 15, 0).getTime();

const base = { id: 'e', childId: 'c', endAt: null, notes: null, createdAt: 0, updatedAt: 0 };

describe('timer notification', () => {
  it('counts a sleep up from when it started', () => {
    const sleep = {
      ...base,
      type: 'sleep',
      startAt: now - 42 * MIN,
      data: {},
    } as BabyEvent<'sleep'>;
    expect(timerNotification(sleep, 'Robin', now)).toMatchObject({
      key: 'sleep',
      title: 'Robin is sleeping',
      startAt: now - 42 * MIN,
      running: true,
    });
  });

  it('counts a breastfeed up from its total so far, and stops the clock when paused', () => {
    const data = { leftMs: 10 * MIN, rightMs: 0, activeSide: 'R', activeSince: now - 5 * MIN };
    const feed = {
      ...base,
      type: 'feed_breast',
      startAt: now - 20 * MIN,
      data,
    } as unknown as BabyEvent<'feed_breast'>;
    expect(timerNotification(feed, 'Robin', now)).toMatchObject({
      title: 'Breastfeeding on the right',
      text: 'Left 10m · Right 5m',
      startAt: now - 15 * MIN,
      running: true,
    });

    const paused = {
      ...feed,
      data: { ...data, rightMs: 5 * MIN, activeSide: null, activeSince: null },
    };
    expect(timerNotification(paused as typeof feed, 'Robin', now)).toMatchObject({
      title: 'Breastfeeding paused',
      text: '15m so far · Left 10m · Right 5m',
      running: false,
    });
  });
});
