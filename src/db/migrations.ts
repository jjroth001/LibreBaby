import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Ordered list of schema migrations. Each entry upgrades the database by one
 * version (tracked in `PRAGMA user_version`). Never edit a migration that has
 * shipped — append a new one instead.
 */
const MIGRATIONS: string[] = [
  // 1: initial schema
  `
  CREATE TABLE child (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    birth_date  TEXT NOT NULL, -- local calendar date, YYYY-MM-DD
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE event (
    id          TEXT PRIMARY KEY NOT NULL,
    child_id    TEXT NOT NULL REFERENCES child(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('sleep', 'feed_breast', 'feed_bottle', 'feed_solids', 'diaper')),
    start_at    INTEGER NOT NULL, -- unix ms
    end_at      INTEGER,          -- unix ms; NULL = in progress or instantaneous
    data        TEXT NOT NULL DEFAULT '{}',
    notes       TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER           -- soft delete, keeps history for future sync
  );

  CREATE INDEX event_child_start ON event (child_id, start_at);

  CREATE TABLE setting (
    key    TEXT PRIMARY KEY NOT NULL,
    value  TEXT NOT NULL
  );
  `,
];

/** Runs on every app start via `SQLiteProvider.onInit`, before any screen renders. */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
