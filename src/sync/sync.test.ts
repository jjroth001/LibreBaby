/**
 * Family sync between simulated phones: each has a real SQLite database (Node's), the
 * real data layer, and talks through the real encryption/framing in memory.
 */
import { randomUUID as mockRandomUUID } from 'crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createChild } from '@/db/children';
import { onDbChanged } from '@/db/db-changes';
import { deleteEvent, insertEvent, listEvents, startTimer, updateEvent } from '@/db/events';
import type { Child } from '@/db/types';
import { openTestDatabase, runMigrations } from '@/test-utils/node-sqlite';
import { channelPair, newKey, replayChannel } from '@/test-utils/sync-channel';

import { applyChanges } from './changes';

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

  it('has open screens re-read once a sync saved something, and only then', async () => {
    const { a, b, child } = await family();
    const nudges = jest.fn();
    const subscription = onDbChanged(nudges);
    try {
      const sleep = await startTimer(a.db, {
        childId: child.id,
        type: 'sleep',
        startAt: clock - 60 * MIN,
        data: {},
      });
      await sync(a, b);
      // Ended on one phone (as from the widget); the other learns of it on the next sync.
      await updateEvent(a.db, sleep.id, { endAt: clock });
      nudges.mockClear();
      await sync(a, b);
      expect(nudges).toHaveBeenCalledWith(['event', 'child']);

      await sync(a, b); // B re-offers what it merged; settles after this
      nudges.mockClear();
      await sync(a, b);
      expect(nudges).not.toHaveBeenCalled();
    } finally {
      subscription.remove();
    }
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

  it('sends entries from before sync existed (upgrade from 1.2 to 1.3.0, then 1.3.1)', async () => {
    // Dad logged entries on an app version without change tracking (migrations 1-3).
    const dadDb = openTestDatabase(3);
    const robin = await createChild(dadDb, {
      name: 'Robin',
      birthDate: '2026-03-14',
      sex: 'male',
    });
    for (let i = 0; i < 5; i++) await insertEvent(dadDb, diaper(robin.id, clock - i * MIN));
    // Updated to 1.3.0 (migration 4), paired, and the first sync recorded Mom as sent-to
    // without sending those old rows (the 1.3.0 bug).
    await runMigrations(dadDb, 3, 4);
    await dadDb.runAsync(
      "INSERT INTO sync_peer (device_id, name, last_sent_seq) VALUES ('device-b', 'Mom', (SELECT n FROM sync_counter))",
    );
    // Then updated to 1.3.1.
    await runMigrations(dadDb, 4);

    const dad: Phone = { db: dadDb, deviceId: 'device-a', name: 'Dad' };
    const mom: Phone = { db: openTestDatabase(), deviceId: 'device-b', name: 'Mom' };
    await mom.db.runAsync(
      "INSERT INTO child (id, name, birth_date, created_at, updated_at) VALUES (?, 'Baby', '2026-03-14', 0, 0)",
      robin.id,
    );

    await sync(dad, mom);
    expect(await all(mom, robin.id)).toHaveLength(5);
    expect(await mom.db.getFirstAsync('SELECT name FROM child')).toEqual({ name: 'Robin' });
  });

  it('recovers entries that 1.3.x recorded as sent but lost (upgrade to 1.4.1)', async () => {
    const { a, b, child } = await family();
    await sync(a, b);
    // On 1.3.x (migrations 1-5), A logged entries and recorded B as sent-to without B
    // ever receiving them.
    const lost = await insertEvent(a.db, diaper(child.id, clock - 5 * MIN));
    await a.db.runAsync('UPDATE sync_peer SET last_sent_seq = (SELECT n FROM sync_counter)');
    await sync(a, b);
    expect(await all(b, child.id)).toHaveLength(0); // the stuck state

    // Simulate the upgrade by re-running migration 6 (both test phones are on the latest).
    await runMigrations(a.db, 5);
    await sync(a, b);
    expect((await all(b, child.id)).map((e) => e.id)).toEqual([lost.id]);
  });

  it('refuses a phone with the wrong family key, without changing anything', async () => {
    const { a, b, child } = await family();
    await insertEvent(a.db, diaper(child.id, clock));
    await expect(sync(a, b, newKey())).rejects.toThrow(/different family/);
    expect(await all(b, child.id)).toHaveLength(0);
  });

  it('resends what a dropped connection lost, instead of treating it as delivered', async () => {
    const { a, b, child } = await family();
    await sync(a, b);
    await insertEvent(a.db, diaper(child.id, clock - 5 * MIN));

    // The connection dies right after A's hello: A's new entry never reaches B.
    const key = newKey();
    const [ca, cb] = channelPair(key, key, 'family', 'family', 1);
    // As in the app, a phone closes its connection when its session ends or fails.
    await Promise.allSettled([
      runSyncSession({ db: a.db, channel: ca, me: a }).finally(() => ca.close()),
      runSyncSession({ db: b.db, channel: cb, me: b }).finally(() => cb.close()),
    ]);
    expect(await all(b, child.id)).toHaveLength(0);

    // The next sync must still carry it.
    await sync(a, b);
    expect(await all(b, child.id)).toHaveLength(1);
  });

  it('delivers both ways in one sync, whichever phone dials', async () => {
    const { a, b, child } = await family();
    await sync(a, b);
    await insertEvent(a.db, diaper(child.id, clock - 20 * MIN));
    await insertEvent(b.db, diaper(child.id, clock - 10 * MIN));
    await sync(b, a);
    expect(await all(a, child.id)).toHaveLength(2);
    expect(await all(b, child.id)).toHaveLength(2);
  });
  it('refuses a replayed recording of another phone’s sync, and still resends later', async () => {
    const { a, b, child } = await family();
    // Someone on the Wi-Fi records everything B sends during a sync.
    const recorded: Uint8Array[] = [];
    const key = newKey();
    const [ca, cb] = channelPair(key, key, 'family', 'family', undefined, (byA, bytes) => {
      if (!byA) recorded.push(bytes);
    });
    await Promise.all([
      runSyncSession({ db: a.db, channel: ca, me: a }),
      runSyncSession({ db: b.db, channel: cb, me: b }),
    ]);
    await insertEvent(a.db, diaper(child.id, clock - 5 * MIN));
    const before = await a.db.getFirstAsync('SELECT last_sent_seq FROM sync_peer');

    // Played back to A later, it must not pass for B (nor mark A's new entry delivered).
    await expect(
      runSyncSession({ db: a.db, channel: replayChannel(key, recorded), me: a }),
    ).rejects.toThrow(/different family/);
    expect(await a.db.getFirstAsync('SELECT last_sent_seq FROM sync_peer')).toEqual(before);

    await sync(a, b);
    expect(await all(b, child.id)).toHaveLength(1);
  });

  it('drops malformed rows from another phone and keeps the rest', async () => {
    const { a, child } = await family();
    const good = {
      id: 'good',
      child_id: child.id,
      type: 'diaper',
      start_at: clock,
      end_at: null,
      data: '{"wet":true,"dirty":false}',
      notes: null,
      created_at: clock,
      updated_at: clock,
      deleted_at: null,
    };
    const written = await applyChanges(a.db, {
      children: [{ id: 'x' } as any],
      events: [
        good,
        { ...good, id: 'bad-json', data: 'oops' },
        { ...good, id: 'bad-type', type: 'teleport' },
        { ...good, id: 'bad-array', data: '[1]' },
        { ...good, id: 'bad-time', start_at: 'noon' as any },
      ],
    });
    expect(written).toBe(1);
    expect((await all(a, child.id)).map((e) => e.id)).toEqual(['good']);
  });

  it('treats edits dated in the future as made now, so later edits still win', async () => {
    const { a, b, child } = await family();
    await sync(a, b);
    const event = await insertEvent(a.db, diaper(child.id, clock - 30 * MIN));
    // A's clock is years ahead when it edits the entry.
    await a.db.runAsync(
      "UPDATE event SET notes = 'from the future', updated_at = ? WHERE id = ?",
      Date.UTC(2100, 0, 1),
      event.id,
    );
    await sync(a, b);
    const synced = await b.db.getFirstAsync<{ updated_at: number }>(
      'SELECT updated_at FROM event WHERE id = ?',
      event.id,
    );
    expect(synced!.updated_at).toBeLessThan(Date.UTC(2100, 0, 1));

    // B's later edit isn't overwritten by A's future-dated one.
    await updateEvent(b.db, event.id, { notes: 'fixed on B' });
    await insertEvent(a.db, diaper(child.id, clock)); // something new to sync
    await sync(a, b);
    expect((await all(b, child.id)).find((e) => e.id === event.id)?.notes).toBe('fixed on B');
  });
  it('asks to update a family phone on an older version, and ignores strangers', async () => {
    const { a } = await family();
    const key = newKey();
    const [ca, cOld] = channelPair(key, key);
    await cOld.send({ t: 'hello', v: 3, deviceId: 'device-old', name: 'Old phone' });
    const peers: string[] = [];
    await expect(
      runSyncSession({ db: a.db, channel: ca, me: a, onPeer: (p) => peers.push(p.name) }),
    ).rejects.toThrow('Update LibreBaby on Old phone to sync with it.');
    expect(peers).toEqual(['Old phone']);

    const [cMine, cStranger] = channelPair(key, newKey());
    await cStranger.send({ t: 'hello', v: 4, deviceId: 'x', name: 'X', nonce: cStranger.nonce });
    await expect(
      runSyncSession({ db: a.db, channel: cMine, me: a, onPeer: (p) => peers.push(p.name) }),
    ).rejects.toThrow(/different family/);
    expect(peers).toEqual(['Old phone']);
  });
});
