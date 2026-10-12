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

  // 2: allow new event types (medication, pump). SQLite can't alter a CHECK constraint,
  // so the table is rebuilt — without the type list this time, so new types never need
  // another rebuild. Valid types are enforced by the TypeScript EventType union instead.
  `
  CREATE TABLE event_new (
    id          TEXT PRIMARY KEY NOT NULL,
    child_id    TEXT NOT NULL REFERENCES child(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    start_at    INTEGER NOT NULL,
    end_at      INTEGER,
    data        TEXT NOT NULL DEFAULT '{}',
    notes       TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
  );

  INSERT INTO event_new (id, child_id, type, start_at, end_at, data, notes, created_at, updated_at, deleted_at)
    SELECT id, child_id, type, start_at, end_at, data, notes, created_at, updated_at, deleted_at FROM event;

  DROP TABLE event;
  ALTER TABLE event_new RENAME TO event;
  CREATE INDEX event_child_start ON event (child_id, start_at);
  `,

  // 3: sex, for choosing the WHO growth chart (NULL until set)
  `
  ALTER TABLE child ADD COLUMN sex TEXT;
  `,

  // 4: family sync. Every write to a child or event row takes the next number from a
  // per-phone counter (change_seq), via triggers — including rows merged in from another
  // phone, so changes relay onward. A counter, not a clock: "send everything after N" can
  // never skip a change, whatever the clocks do. UPDATE OF lists every column except
  // change_seq, so a trigger can't re-fire itself.
  `
  CREATE TABLE sync_counter (
    id  INTEGER PRIMARY KEY CHECK (id = 1),
    n   INTEGER NOT NULL
  );
  INSERT INTO sync_counter (id, n) VALUES (1, 0);

  ALTER TABLE event ADD COLUMN change_seq INTEGER;
  ALTER TABLE child ADD COLUMN change_seq INTEGER;
  CREATE INDEX event_change_seq ON event (change_seq);

  CREATE TRIGGER event_changed_insert AFTER INSERT ON event BEGIN
    UPDATE sync_counter SET n = n + 1 WHERE id = 1;
    UPDATE event SET change_seq = (SELECT n FROM sync_counter WHERE id = 1) WHERE id = NEW.id;
  END;
  CREATE TRIGGER event_changed_update
  AFTER UPDATE OF child_id, type, start_at, end_at, data, notes, updated_at, deleted_at ON event
  BEGIN
    UPDATE sync_counter SET n = n + 1 WHERE id = 1;
    UPDATE event SET change_seq = (SELECT n FROM sync_counter WHERE id = 1) WHERE id = NEW.id;
  END;

  CREATE TRIGGER child_changed_insert AFTER INSERT ON child BEGIN
    UPDATE sync_counter SET n = n + 1 WHERE id = 1;
    UPDATE child SET change_seq = (SELECT n FROM sync_counter WHERE id = 1) WHERE id = NEW.id;
  END;
  CREATE TRIGGER child_changed_update AFTER UPDATE OF name, birth_date, sex, updated_at ON child
  BEGIN
    UPDATE sync_counter SET n = n + 1 WHERE id = 1;
    UPDATE child SET change_seq = (SELECT n FROM sync_counter WHERE id = 1) WHERE id = NEW.id;
  END;

  -- Per paired phone: the counter value up to which we've sent it our changes.
  CREATE TABLE sync_peer (
    device_id       TEXT PRIMARY KEY NOT NULL,
    name            TEXT NOT NULL,
    last_sent_seq   INTEGER NOT NULL DEFAULT 0,
    last_synced_at  INTEGER
  );
  `,

  // 5: rows that existed before migration 4 were never stamped (change_seq NULL), and the
  // first sync only sent stamped rows — so a phone's older entries and profile never
  // reached a newly paired phone. Stamp them all now so the next sync sends them.
  `
  UPDATE sync_counter SET n = n + 1 WHERE id = 1;
  UPDATE event SET change_seq = (SELECT n FROM sync_counter WHERE id = 1) WHERE change_seq IS NULL;
  UPDATE child SET change_seq = (SELECT n FROM sync_counter WHERE id = 1) WHERE change_seq IS NULL;
  `,
];

/** The migration SQL in order (for tests that build a database from scratch). */
export function migrateSql(): readonly string[] {
  return MIGRATIONS;
}

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
