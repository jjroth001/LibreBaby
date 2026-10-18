import type { SQLiteDatabase } from 'expo-sqlite';

import {
  clampChildTimes,
  clampEventTimes,
  isChildRow,
  isEventRow,
  planEventMerge,
  type ChildRow,
  type EventRow,
} from '@/db/backup';
import { TIMER_TYPES } from '@/db/events';

/** What one phone sends another: rows changed (on the sender) since a point in time. */
export type Changeset = { children: ChildRow[]; events: EventRow[] };

const CHILD_COLUMNS = 'id, name, birth_date, sex, created_at, updated_at';
const EVENT_COLUMNS =
  'id, child_id, type, start_at, end_at, data, notes, created_at, updated_at, deleted_at';

/** The current value of this phone's change counter. */
export async function currentChangeSeq(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT n FROM sync_counter WHERE id = 1');
  return row?.n ?? 0;
}

/** Rows changed here after counter value `since`. Never-stamped rows are always included. */
export async function collectChanges(db: SQLiteDatabase, since: number): Promise<Changeset> {
  const [children, events] = await Promise.all([
    db.getAllAsync<ChildRow>(
      `SELECT ${CHILD_COLUMNS} FROM child WHERE change_seq IS NULL OR change_seq > ?`,
      since,
    ),
    db.getAllAsync<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM event WHERE change_seq IS NULL OR change_seq > ? ORDER BY start_at`,
      since,
    ),
  ]);
  return { children, events };
}

/**
 * Merges another phone's rows: each is written if it's new here or its `updated_at` is
 * newer (so the latest edit wins, and soft deletes travel as ordinary rows). Returns how
 * many rows changed here. Malformed rows are dropped, and no edit counts as newer than now.
 */
export async function applyChanges(
  db: SQLiteDatabase,
  changes: Changeset,
  now = Date.now(),
): Promise<number> {
  const children = changes.children.filter(isChildRow).map((c) => clampChildTimes(c, now));
  const events = changes.events.filter(isEventRow).map((e) => clampEventTimes(e, now));
  let written = 0;
  await db.withTransactionAsync(async () => {
    for (const c of children) {
      const r = await db.runAsync(
        `INSERT INTO child (${CHILD_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, birth_date = excluded.birth_date,
           sex = excluded.sex, updated_at = excluded.updated_at
         WHERE excluded.updated_at > child.updated_at`,
        c.id,
        c.name,
        c.birth_date,
        c.sex ?? null,
        c.created_at,
        c.updated_at,
      );
      written += r.changes;
    }

    if (events.length === 0) return;
    // Only events for a profile we have (avoids a foreign-key failure aborting the merge).
    const childIds = new Set(
      (await db.getAllAsync<{ id: string }>('SELECT id FROM child')).map((c) => c.id),
    );
    const incoming = events.filter((e) => childIds.has(e.child_id));
    const existing = await db.getAllAsync<{ id: string; updated_at: number }>(
      `SELECT id, updated_at FROM event WHERE id IN (${incoming.map(() => '?').join(', ')})`,
      ...incoming.map((e) => e.id),
    );
    const plan = planEventMerge(new Map(existing.map((e) => [e.id, e.updated_at])), incoming);
    for (const e of plan.toWrite) {
      await db.runAsync(
        `INSERT OR REPLACE INTO event (${EVENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id,
        e.child_id,
        e.type,
        e.start_at,
        e.end_at,
        e.data,
        e.notes,
        e.created_at,
        e.updated_at,
        e.deleted_at,
      );
    }
    written += plan.toWrite.length;
  });
  return written;
}

/**
 * If both parents started a sleep (or breastfeed) timer before syncing, there are now two
 * running. Keep the earlier one and delete the other — every phone picks the same one
 * (earliest start, then lowest id), so they agree without talking.
 */
export async function reconcileRunningTimers(db: SQLiteDatabase, now: number): Promise<number> {
  const running = await db.getAllAsync<{ id: string; child_id: string; type: string }>(
    `SELECT id, child_id, type FROM event
     WHERE end_at IS NULL AND deleted_at IS NULL
       AND type IN (${TIMER_TYPES.map((t) => `'${t}'`).join(', ')})
     ORDER BY start_at, id`,
  );
  const kept = new Set<string>();
  const extra: string[] = [];
  for (const row of running) {
    const key = `${row.child_id}|${row.type}`;
    if (kept.has(key)) extra.push(row.id);
    else kept.add(key);
  }
  for (const id of extra) {
    await db.runAsync('UPDATE event SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
  }
  return extra.length;
}
