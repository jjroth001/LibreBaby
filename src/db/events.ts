import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { BabyEvent, EventType, NewEvent } from './types';

type EventRow = {
  id: string;
  child_id: string;
  type: EventType;
  start_at: number;
  end_at: number | null;
  data: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

function fromRow(row: EventRow): BabyEvent {
  return {
    id: row.id,
    childId: row.child_id,
    type: row.type,
    startAt: row.start_at,
    endAt: row.end_at,
    data: JSON.parse(row.data),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as BabyEvent;
}

export async function insertEvent<T extends EventType>(
  db: SQLiteDatabase,
  input: NewEvent<T>,
): Promise<BabyEvent<T>> {
  const now = Date.now();
  const event = {
    id: randomUUID(),
    endAt: null,
    notes: null,
    ...input,
    createdAt: now,
    updatedAt: now,
  } as BabyEvent<T>;
  await db.runAsync(
    `INSERT INTO event (id, child_id, type, start_at, end_at, data, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    event.childId,
    event.type,
    event.startAt,
    event.endAt,
    JSON.stringify(event.data),
    event.notes,
    event.createdAt,
    event.updatedAt,
  );
  return event;
}

export async function updateEvent<T extends EventType>(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<Pick<BabyEvent<T>, 'startAt' | 'endAt' | 'data' | 'notes'>>,
): Promise<void> {
  const columns: Record<string, string | number | null> = {};
  if (patch.startAt !== undefined) columns.start_at = patch.startAt;
  if (patch.endAt !== undefined) columns.end_at = patch.endAt;
  if (patch.data !== undefined) columns.data = JSON.stringify(patch.data);
  if (patch.notes !== undefined) columns.notes = patch.notes;
  columns.updated_at = Date.now();

  const assignments = Object.keys(columns).map((column) => `${column} = ?`);
  await db.runAsync(`UPDATE event SET ${assignments.join(', ')} WHERE id = ?`, [
    ...Object.values(columns),
    id,
  ]);
}

/**
 * Read-modify-write against the latest stored row, so rapid taps never compute
 * from stale on-screen state.
 */
export async function modifyEvent<T extends EventType>(
  db: SQLiteDatabase,
  id: string,
  change: (current: BabyEvent<T>) => Partial<Pick<BabyEvent<T>, 'startAt' | 'endAt' | 'data' | 'notes'>>,
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<EventRow>('SELECT * FROM event WHERE id = ?', id);
    if (row) await updateEvent<T>(txn, id, change(fromRow(row) as BabyEvent<T>));
  });
}

/** Soft delete: the row is kept (hidden) so a future sync can propagate the deletion. */
export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.runAsync('UPDATE event SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}

/** Event types that run as timers; for these, `end_at IS NULL` means "in progress". */
export const TIMER_TYPES = ['sleep', 'feed_breast'] as const;
export type TimerType = (typeof TIMER_TYPES)[number];

const RUNNING_TIMER_SQL = `(end_at IS NULL AND type IN (${TIMER_TYPES.map((t) => `'${t}'`).join(', ')}))`;

export async function listRunningTimers(
  db: SQLiteDatabase,
  childId: string,
): Promise<BabyEvent<TimerType>[]> {
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM event
     WHERE child_id = ? AND deleted_at IS NULL AND ${RUNNING_TIMER_SQL}
     ORDER BY start_at`,
    childId,
  );
  return rows.map(fromRow) as BabyEvent<TimerType>[];
}

/**
 * Starts a timer unless one of that type is already running (guards against double taps),
 * returning whichever is running afterwards.
 */
export async function startTimer<T extends TimerType>(
  db: SQLiteDatabase,
  input: NewEvent<T>,
): Promise<BabyEvent<T>> {
  let result: BabyEvent<T> | undefined;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const running = await txn.getFirstAsync<EventRow>(
      `SELECT * FROM event
       WHERE child_id = ? AND type = ? AND end_at IS NULL AND deleted_at IS NULL`,
      input.childId,
      input.type,
    );
    result = running ? (fromRow(running) as BabyEvent<T>) : await insertEvent(txn, input);
  });
  return result!;
}

/** Most recent event of the given types, ignoring timers still running. */
export async function getLatestEvent<T extends EventType>(
  db: SQLiteDatabase,
  childId: string,
  types: readonly T[],
): Promise<BabyEvent<T> | null> {
  const row = await db.getFirstAsync<EventRow>(
    `SELECT * FROM event
     WHERE child_id = ? AND deleted_at IS NULL AND NOT ${RUNNING_TIMER_SQL}
       AND type IN (${types.map(() => '?').join(', ')})
     ORDER BY start_at DESC
     LIMIT 1`,
    childId,
    ...types,
  );
  return row ? (fromRow(row) as BabyEvent<T>) : null;
}

/** Events overlapping [fromMs, toMs), oldest first. */
export async function listEvents(
  db: SQLiteDatabase,
  childId: string,
  fromMs: number,
  toMs: number,
): Promise<BabyEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    `SELECT * FROM event
     WHERE child_id = ? AND deleted_at IS NULL
       AND start_at < ? AND COALESCE(end_at, start_at) >= ?
     ORDER BY start_at`,
    childId,
    toMs,
    fromMs,
  );
  return rows.map(fromRow);
}
