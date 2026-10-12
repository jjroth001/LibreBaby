/**
 * Test-only: wraps Node's built-in SQLite in the subset of expo-sqlite's async API the
 * data layer uses, so database code (migrations, merges, sync) can run under Jest against
 * a real SQLite engine. Never imported by the app.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';

import { migrateSql } from '@/db/migrations';

type Params = unknown[];

function flatten(params: unknown[]): Params {
  return params.length === 1 && Array.isArray(params[0]) ? (params[0] as Params) : params;
}

/**
 * A fresh database. Pass `migrations` to stop early (e.g. to create data the way an older
 * app version would), then finish with `runMigrations`.
 */
export function openTestDatabase(migrations = migrateSql().length): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of migrateSql().slice(0, migrations)) db.exec(sql);

  const adapter = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const r = db.prepare(sql).run(...(flatten(params) as never[]));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      const row = db.prepare(sql).get(...(flatten(params) as never[]));
      return (row ? { ...row } : null) as T | null;
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return db
        .prepare(sql)
        .all(...(flatten(params) as never[]))
        .map((row) => ({ ...row })) as T[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async withExclusiveTransactionAsync(task: (txn: unknown) => Promise<void>) {
      await adapter.withTransactionAsync(() => task(adapter));
    },
    async closeAsync() {
      db.close();
    },
  };
  return adapter as unknown as SQLiteDatabase;
}

/** Applies migrations [from, to) — simulates upgrading the app. */
export async function runMigrations(db: SQLiteDatabase, from: number, to = migrateSql().length) {
  for (const sql of migrateSql().slice(from, to)) await db.execAsync(sql);
}
