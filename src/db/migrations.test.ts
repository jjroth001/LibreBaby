import { randomUUID as mockRandomUUID } from 'crypto';

import { openTestDatabase, runMigrations } from '@/test-utils/node-sqlite';

import { createChild } from './children';
import { insertEvent, listEvents, listRunningTimers } from './events';
import { migrateSql } from './migrations';

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

const HOUR = 3_600_000;
const day = Date.UTC(2026, 4, 2, 12);

const plan = async (db: ReturnType<typeof openTestDatabase>, sql: string) =>
  (await db.getAllAsync<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`))
    .map((r) => r.detail)
    .join(' ');

describe('migration 7 (speed indexes)', () => {
  it('upgrades a 1.11 database without changing what it reads', async () => {
    // Built the way 1.11 left it: migrations 1–6 and some entries.
    const db = openTestDatabase(7 - 1);
    const child = await createChild(db, { name: 'Wren', birthDate: '2026-03-14', sex: null });
    const sleep = await insertEvent(db, {
      childId: child.id,
      type: 'sleep',
      startAt: day - 30 * HOUR, // began before the range and ends inside it
      endAt: day - 20 * HOUR,
      data: {},
    });
    const old = await insertEvent(db, {
      childId: child.id,
      type: 'diaper',
      startAt: day - 30 * 24 * HOUR,
      data: { wet: true, dirty: false },
    });
    const running = await insertEvent(db, {
      childId: child.id,
      type: 'sleep',
      startAt: day - HOUR,
      data: {},
    });
    const from = day - 24 * HOUR;
    const before = await listEvents(db, child.id, from, day);

    await runMigrations(db, 7 - 1);
    expect(migrateSql()).toHaveLength(7);

    const after = await listEvents(db, child.id, from, day);
    expect(after).toEqual(before);
    expect(after.map((e) => e.id)).toEqual([sleep.id, running.id]);
    expect(after.map((e) => e.id)).not.toContain(old.id);
    expect((await listRunningTimers(db, child.id)).map((e) => e.id)).toEqual([running.id]);
  });

  // The same SQL as listEvents and listRunningTimers.
  it('reads date ranges and running timers through the new indexes', async () => {
    const db = openTestDatabase();
    expect(
      await plan(
        db,
        `SELECT * FROM event WHERE child_id = 'c' AND deleted_at IS NULL
         AND +start_at < 2 AND COALESCE(end_at, start_at) >= 1 ORDER BY start_at`,
      ),
    ).toContain('event_child_end');
    expect(
      await plan(
        db,
        `SELECT * FROM event WHERE child_id = 'c' AND deleted_at IS NULL
         AND (end_at IS NULL AND type IN ('sleep', 'feed_breast')) ORDER BY start_at`,
      ),
    ).toContain('event_running');
  });
});
