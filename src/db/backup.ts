import type { SQLiteDatabase } from 'expo-sqlite';

import { isKnownSetting } from './settings';
import type { EventType } from './types';

/**
 * Backups are the raw database rows as JSON. Soft-deleted events are included so a
 * deletion on one phone carries over when the backup is restored on another.
 */

export const BACKUP_FORMAT = 1;

export type ChildRow = {
  id: string;
  name: string;
  birth_date: string;
  /** Missing in backups made before growth charts. */
  sex?: string | null;
  created_at: number;
  updated_at: number;
};

export type EventRow = {
  id: string;
  child_id: string;
  type: string;
  start_at: number;
  end_at: number | null;
  data: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type SettingRow = { key: string; value: string };

export type Backup = {
  app: 'LibreBaby';
  format: number;
  exportedAt: number;
  children: ChildRow[];
  events: EventRow[];
  settings: SettingRow[];
};

export async function createBackup(db: SQLiteDatabase): Promise<Backup> {
  const [children, events, settings] = await Promise.all([
    db.getAllAsync<ChildRow>('SELECT * FROM child ORDER BY created_at'),
    db.getAllAsync<EventRow>('SELECT * FROM event ORDER BY start_at'),
    // The rounded location stays on this phone.
    db.getAllAsync<SettingRow>(
      "SELECT key, value FROM setting WHERE key <> 'skyLocation' ORDER BY key",
    ),
  ]);
  return {
    app: 'LibreBaby',
    format: BACKUP_FORMAT,
    exportedAt: Date.now(),
    children,
    events,
    settings,
  };
}

// --- Validation -------------------------------------------------------------
// Rows from a file or another phone are checked before they're saved: one malformed row
// would otherwise stop lists loading (and sync would pass it on to every phone).

const KNOWN_TYPES: Record<EventType, true> = {
  sleep: true,
  feed_breast: true,
  feed_bottle: true,
  feed_solids: true,
  diaper: true,
  medication: true,
  pump: true,
  growth: true,
  milestone: true,
};
const MAX_ID = 200;
const MAX_NAME = 200;
const MAX_TEXT = 20_000;

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNullableNumber = (v: unknown) => v === null || isNumber(v);
const isNullableString = (v: unknown) => v === null || isString(v);
const isId = (v: unknown) => isString(v) && v.length > 0 && v.length <= MAX_ID;

/** An entry's details: a JSON object, as the app writes them. */
function isEventData(v: unknown): boolean {
  if (!isString(v) || v.length > MAX_TEXT) return false;
  try {
    const data = JSON.parse(v);
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  } catch {
    return false;
  }
}

export function isChildRow(v: any): v is ChildRow {
  return (
    v &&
    isId(v.id) &&
    isString(v.name) &&
    v.name.length <= MAX_NAME &&
    isString(v.birth_date) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.birth_date) &&
    (v.sex === undefined || v.sex === null || v.sex === 'male' || v.sex === 'female') &&
    isNumber(v.created_at) &&
    isNumber(v.updated_at)
  );
}

export function isEventRow(v: any): v is EventRow {
  return (
    v &&
    isId(v.id) &&
    isId(v.child_id) &&
    isString(v.type) &&
    Object.prototype.hasOwnProperty.call(KNOWN_TYPES, v.type) &&
    isNumber(v.start_at) &&
    isNullableNumber(v.end_at) &&
    isEventData(v.data) &&
    isNullableString(v.notes) &&
    (v.notes === null || v.notes.length <= MAX_TEXT) &&
    isNumber(v.created_at) &&
    isNumber(v.updated_at) &&
    isNullableNumber(v.deleted_at)
  );
}

/**
 * No incoming edit can be dated after now. Merges keep the newest edit, so a phone with a
 * wrong clock (or a crafted file) could otherwise pin a row so that no later edit or delete
 * ever wins.
 */
export function clampChildTimes(row: ChildRow, now: number): ChildRow {
  return {
    ...row,
    created_at: Math.min(row.created_at, now),
    updated_at: Math.min(row.updated_at, now),
  };
}

export function clampEventTimes(row: EventRow, now: number): EventRow {
  return {
    ...row,
    created_at: Math.min(row.created_at, now),
    updated_at: Math.min(row.updated_at, now),
    deleted_at: row.deleted_at === null ? null : Math.min(row.deleted_at, now),
  };
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function isSettingRow(v: any): v is SettingRow {
  return v && isString(v.key) && isString(v.value);
}

/** Parses and checks a backup file. Throws an Error with a user-facing message. */
export function parseBackup(text: string): Backup {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t a LibreBaby backup (it isn’t valid JSON).');
  }
  if (!raw || raw.app !== 'LibreBaby') {
    throw new Error('This file isn’t a LibreBaby backup.');
  }
  if (!isNumber(raw.format) || raw.format > BACKUP_FORMAT) {
    throw new Error('This backup was made by a newer version of LibreBaby. Update the app first.');
  }
  const ok =
    Array.isArray(raw.children) &&
    Array.isArray(raw.events) &&
    Array.isArray(raw.settings) &&
    raw.children.every(isChildRow) &&
    raw.events.every(isEventRow) &&
    raw.settings.every(isSettingRow);
  if (!ok) throw new Error('This backup is damaged or incomplete, so nothing was imported.');
  return raw as Backup;
}

// --- Merging ----------------------------------------------------------------

export type MergePlan = {
  /** Rows to write: new ones, plus ones whose backup copy is newer. */
  toWrite: EventRow[];
  added: number;
  updated: number;
  unchanged: number;
};

/**
 * Decides which backup events to write, given each existing event's `updated_at`.
 * Newer always wins, so restoring the same backup twice changes nothing.
 */
export function planEventMerge(existing: Map<string, number>, incoming: EventRow[]): MergePlan {
  const plan: MergePlan = { toWrite: [], added: 0, updated: 0, unchanged: 0 };
  for (const row of incoming) {
    const current = existing.get(row.id);
    if (current === undefined) {
      plan.toWrite.push(row);
      plan.added++;
    } else if (row.updated_at > current) {
      plan.toWrite.push(row);
      plan.updated++;
    } else {
      plan.unchanged++;
    }
  }
  return plan;
}

export type ImportResult = { added: number; updated: number; unchanged: number };

/**
 * Merges a backup into the database.
 *
 * With `intoChildId` (the app already has a profile), every backup event is attached
 * to that child and the backup's profile is ignored — v1 tracks one child. Without
 * it (restoring onto a fresh install), the backup's profile is restored too.
 * Settings are only filled in where this phone has none, so preferences aren't overwritten.
 */
export async function importBackup(
  db: SQLiteDatabase,
  backup: Backup,
  intoChildId?: string,
  now = Date.now(),
): Promise<ImportResult> {
  const incoming = backup.events.map((event) =>
    clampEventTimes(intoChildId ? { ...event, child_id: intoChildId } : event, now),
  );

  const existingRows = await db.getAllAsync<{ id: string; updated_at: number }>(
    'SELECT id, updated_at FROM event',
  );
  const plan = planEventMerge(new Map(existingRows.map((r) => [r.id, r.updated_at])), incoming);

  await db.withTransactionAsync(async () => {
    if (!intoChildId) {
      for (const child of backup.children.map((c) => clampChildTimes(c, now))) {
        await db.runAsync(
          `INSERT INTO child (id, name, birth_date, sex, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET name = excluded.name, birth_date = excluded.birth_date,
             sex = excluded.sex, updated_at = excluded.updated_at
           WHERE excluded.updated_at > child.updated_at`,
          child.id,
          child.name,
          child.birth_date,
          child.sex ?? null,
          child.created_at,
          child.updated_at,
        );
      }
    }
    for (const e of plan.toWrite) {
      await db.runAsync(
        `INSERT OR REPLACE INTO event
           (id, child_id, type, start_at, end_at, data, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    for (const s of backup.settings) {
      // Only settings this version knows, with values it can read; the location never.
      if (s.key === 'skyLocation' || !isKnownSetting(s.key) || !isJson(s.value)) continue;
      await db.runAsync('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', s.key, s.value);
    }
  });

  return { added: plan.added, updated: plan.updated, unchanged: plan.unchanged };
}
