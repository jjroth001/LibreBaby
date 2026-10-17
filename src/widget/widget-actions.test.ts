import { randomUUID as mockRandomUUID } from 'crypto';

import { createChild } from '@/db/children';
import { deleteEvent, getEvent, insertEvent } from '@/db/events';
import type { BabyEvent } from '@/db/types';
import { startBreast } from '@/lib/breast';
import { openTestDatabase } from '@/test-utils/node-sqlite';

import { applyWidgetAction, switchTarget, WIDGET_ACTIONS } from './widget-actions';

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

const MIN = 60_000;
const t0 = new Date(2026, 9, 12, 14, 0).getTime();

async function setup() {
  const db = openTestDatabase();
  const child = await createChild(db, { name: 'Robin', birthDate: '2026-03-14', sex: 'male' });
  const sleep = await insertEvent(db, { childId: child.id, type: 'sleep', startAt: t0, data: {} });
  const feed = await insertEvent(db, {
    childId: child.id,
    type: 'feed_breast',
    startAt: t0,
    data: startBreast('L', t0),
  });
  return { db, sleep, feed };
}

describe('widget buttons', () => {
  it('"Woke up" ends a running sleep', async () => {
    const { db, sleep } = await setup();
    const now = t0 + 72 * MIN;
    expect(await applyWidgetAction(db, WIDGET_ACTIONS.wake, { eventId: sleep.id }, now)).toBe(true);
    expect((await getEvent(db, sleep.id))?.endAt).toBe(now);
  });

  it('does nothing if the timer was already stopped (an out-of-date widget)', async () => {
    const { db, sleep } = await setup();
    await applyWidgetAction(db, WIDGET_ACTIONS.wake, { eventId: sleep.id }, t0 + 10 * MIN);
    expect(
      await applyWidgetAction(db, WIDGET_ACTIONS.wake, { eventId: sleep.id }, t0 + 20 * MIN),
    ).toBe(false);
    expect((await getEvent(db, sleep.id))?.endAt).toBe(t0 + 10 * MIN);
  });

  it('does nothing for a deleted timer, a wrong type or bad data', async () => {
    const { db, sleep, feed } = await setup();
    expect(await applyWidgetAction(db, WIDGET_ACTIONS.wake, { eventId: feed.id }, t0)).toBe(false);
    expect(await applyWidgetAction(db, WIDGET_ACTIONS.done, { eventId: sleep.id }, t0)).toBe(false);
    expect(
      await applyWidgetAction(db, WIDGET_ACTIONS.side, { eventId: feed.id, side: 'X' }, t0),
    ).toBe(false);
    expect(await applyWidgetAction(db, WIDGET_ACTIONS.wake, {}, t0)).toBe(false);
    await deleteEvent(db, sleep.id);
    expect(await applyWidgetAction(db, WIDGET_ACTIONS.wake, { eventId: sleep.id }, t0)).toBe(false);
  });

  it('switches sides, pauses and finishes a breastfeed like the app does', async () => {
    const { db, feed } = await setup();
    const tap = (side: 'L' | 'R', at: number) =>
      applyWidgetAction(db, WIDGET_ACTIONS.side, { eventId: feed.id, side }, t0 + at * MIN);

    await tap('R', 8); // switch: 8 min on the left
    await tap('R', 12); // pause: 4 min on the right
    let current = (await getEvent(db, feed.id)) as BabyEvent<'feed_breast'>;
    expect(current.data).toMatchObject({ leftMs: 8 * MIN, rightMs: 4 * MIN, activeSide: null });

    await tap('R', 20); // resume on the right
    await applyWidgetAction(db, WIDGET_ACTIONS.done, { eventId: feed.id }, t0 + 23 * MIN);
    current = (await getEvent(db, feed.id)) as BabyEvent<'feed_breast'>;
    expect(current.endAt).toBe(t0 + 23 * MIN);
    expect(current.data).toMatchObject({
      side: 'both',
      lastSide: 'R',
      leftMs: 8 * MIN,
      rightMs: 7 * MIN,
      activeSide: null,
    });
  });

  it('"Switch side" goes to the other side, or resumes the last one when paused', () => {
    expect(switchTarget('L', 'L')).toBe('R');
    expect(switchTarget('R', 'R')).toBe('L');
    expect(switchTarget(null, 'R')).toBe('R');
  });
});
