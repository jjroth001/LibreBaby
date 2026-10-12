/**
 * Family sync between simulated phones: each has a real SQLite database (Node's), the
 * real data layer, and talks through the real encryption/framing in memory.
 */
import { randomUUID as mockRandomUUID } from 'crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createChild } from '@/db/children';
import { deleteEvent, insertEvent, listEvents, startTimer, updateEvent } from '@/db/events';
import type { Child } from '@/db/types';
import { openTestDatabase } from '@/test-utils/node-sqlite';
import { channelPair, newKey } from '@/test-utils/sync-channel';

import { runSyncSession } from './session';

// expo-crypto is native; use Node's UUIDs in tests. (`mock` prefix: allowed in jest.mock.)
jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

const MIN = 60_000;
let clock = Date.UTC(2026, 9, 12, 12);
beforeEach(() => {
  jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));
});
afterEach(() => jest.restoreAllMocks());

type Phone = { db: SQLiteDatabase; deviceId: string; name: string };

async function sync(a: Phone, b: Phone, keyB?: Uint8Array) {
  const key = newKey();
  const [ca, cb] = channelPair(key, keyB ?? key);
  return Promise.all([
    runSyncSession({ db: a.db, channel: ca, me: a }),
    runSyncSession({ db: b.db, channel: cb, me: b }),
  ]);
}

/** Phone A has the profile; B "joined" (has the same child id, as joining arranges). */
async function family(): Promise<{ a: Phone; b: Phone; child: Child }> {
  const a: Phone = { db: openTestDatabase(), deviceId: 'device-a', name: 'Dad’s phone' };
  const b: Phone = { db: openTestDatabase(), deviceId: 'device-b', name: 'Mom’s phone' };
  const child = await createChild(a.db, { name: 'Robin', birthDate: '2026-03-14', sex: 'male' });
  // Joining creates a placeholder with the family's child id, older than any real edit.
  await b.db.runAsync(
    "INSERT INTO child (id, name, birth_date, sex, created_at, updated_at) VALUES (?, 'Baby', '2026-03-14', NULL, 0, 0)",
    child.id,
  );
  return { a, b, child };
}

const all = (p: Phone, childId: string) => listEvents(p.db, childId, 0, Number.MAX_SAFE_INTEGER);

const diaper = (childId: string, startAt: number) =>
  ({ childId, type: 'diaper', startAt, data: { wet: true, dirty: false } }) as const;

describe('family sync', () => {
  it('sends the profile and all entries to a newly joined phone', async () => {
    const { a, b, child } = await family();
    for (let i = 0; i < 700; i++) await insertEvent(a.db, diaper(child.id, clock - i * MIN));

    const [resultA, resultB] = await sync(a, b);
    expect(resultB.received).toBeGreaterThanOrEqual(700); // spans several batches
    expect(resultA.peer).toEqual({ deviceId: 'device-b', name: 'Mom’s phone' });

    expect(await all(b, child.id)).toHaveLength(700);
    expect(await b.db.getFirstAsync('SELECT name, sex FROM child')).toEqual({
      name: 'Robin',
      sex: 'male',
    });
  });

  it('merges entries logged on both phones', async () => {
    const { a, b, child } = await family();
    await sync(a, b);
    await insertEvent(a.db, diaper(child.id, clock - 10 * MIN));
    await insertEvent(b.db, {
      childId: child.id,
      type: 'sleep',
      startAt: clock - 90 * MIN,
      endAt: clock - 30 * MIN,
      data: {},
    });

    await sync(a, b);
    for (const phone of [a, b]) {
      expect((await all(phone, child.id)).map((e) => e.type).sort()).toEqual(['diaper', 'sleep']);
    }
  });

  it('keeps the newer edit when both phones edit the same entry', async () => {
    const { a, b, child } = await family();
    const event = await insertEvent(a.db, diaper(child.id, clock));
    await sync(a, b);

    await updateEvent(a.db, event.id, { notes: 'from dad' });
    await updateEvent(b.db, event.id, { notes: 'from mom (later)' });
    await sync(a, b);

    for (const phone of [a, b]) {
      expect((await all(phone, child.id))[0].notes).toBe('from mom (later)');
    }
  });

  it('carries deletions across', async () => {
    const { a, b, child } = await family();
    const event = await insertEvent(a.db, diaper(child.id, clock));
    await sync(a, b);
    await deleteEvent(b.db, event.id);
    await sync(a, b);
    expect(await all(a, child.id)).toHaveLength(0);
  });

  it('sends only what changed since last time, and settles', async () => {
    const { a, b, child } = await family();
    for (let i = 0; i < 20; i++) await insertEvent(a.db, diaper(child.id, clock - i * MIN));
    await sync(a, b);
    await insertEvent(a.db, diaper(child.id, clock));

    const [second] = await sync(a, b);
    expect(second.sent).toBe(1);

    // Rows B merged get re-offered once (B can't know A already has them) but change
    // nothing, so the exchange settles.
    await sync(a, b);
    const [quiet, quietB] = await sync(a, b);
    expect(quiet.received + quietB.received).toBe(0);
  });

  it('relays changes through a phone to a third one', async () => {
    const { a, b, child } = await family();
    const c: Phone = { db: openTestDatabase(), deviceId: 'device-c', name: 'Grandma’s phone' };
    await c.db.runAsync(
      "INSERT INTO child (id, name, birth_date, created_at, updated_at) VALUES (?, 'Baby', '2026-03-14', 0, 0)",
      child.id,
    );
    await sync(a, b);
    await insertEvent(a.db, diaper(child.id, clock));
    await sync(a, b);
    await sync(b, c);
    expect(await all(c, child.id)).toHaveLength(1);
  });

  it('merges two sleep timers started on both phones into one', async () => {
    const { a, b, child } = await family();
    await sync(a, b);
    const early = await startTimer(a.db, {
      childId: child.id,
      type: 'sleep',
      startAt: clock - 5 * MIN,
      data: {},
    });
    await startTimer(b.db, {
      childId: child.id,
      type: 'sleep',
      startAt: clock - 2 * MIN,
      data: {},
    });

    await sync(a, b);
    for (const phone of [a, b]) {
      const running = (await all(phone, child.id)).filter((e) => e.endAt === null);
      expect(running.map((e) => e.id)).toEqual([early.id]);
    }
  });

  it('refuses a phone with the wrong family key, without changing anything', async () => {
    const { a, b, child } = await family();
    await insertEvent(a.db, diaper(child.id, clock));
    await expect(sync(a, b, newKey())).rejects.toThrow(/different family/);
    expect(await all(b, child.id)).toHaveLength(0);
  });
});
