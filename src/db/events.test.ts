import { randomUUID as mockRandomUUID } from 'crypto';

import { summarizeDay } from '@/lib/day-summary';
import { openTestDatabase } from '@/test-utils/node-sqlite';

import { createChild } from './children';
import { insertEvent, listEvents, startTimer } from './events';

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

const HOUR = 3_600_000;

describe('listEvents', () => {
  it('includes a timer still running from before the range', async () => {
    const db = openTestDatabase();
    const child = await createChild(db, { name: 'Wren', birthDate: '2026-03-14', sex: null });
    const day = new Date(2026, 10, 9).getTime();
    const dayEnd = day + 24 * HOUR;
    const now = day + 6 * HOUR;
    // Asleep since 8 PM yesterday, still asleep at 6 AM.
    const sleep = await startTimer(db, {
      childId: child.id,
      type: 'sleep',
      startAt: day - 4 * HOUR,
      data: {},
    });

    const events = await listEvents(db, child.id, day, dayEnd);
    expect(events.map((e) => e.id)).toEqual([sleep.id]);
    expect(summarizeDay(events, day, dayEnd, now).sleepMs).toBe(6 * HOUR);
  });

  it('still leaves out finished and instant entries from before the range', async () => {
    const db = openTestDatabase();
    const child = await createChild(db, { name: 'Wren', birthDate: '2026-03-14', sex: null });
    const day = new Date(2026, 10, 9).getTime();
    await insertEvent(db, {
      childId: child.id,
      type: 'sleep',
      startAt: day - 10 * HOUR,
      endAt: day - 8 * HOUR,
      data: {},
    });
    // Instant entries have no end either, but they are not running timers.
    await insertEvent(db, {
      childId: child.id,
      type: 'diaper',
      startAt: day - 2 * HOUR,
      data: { wet: true, dirty: false },
    });

    expect(await listEvents(db, child.id, day, day + 24 * HOUR)).toEqual([]);
  });
});
