import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Child } from './types';

type ChildRow = {
  id: string;
  name: string;
  birth_date: string;
  created_at: number;
  updated_at: number;
};

function fromRow(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** v1 supports a single child: returns the first one created, if any. */
export async function getChild(db: SQLiteDatabase): Promise<Child | null> {
  const row = await db.getFirstAsync<ChildRow>('SELECT * FROM child ORDER BY created_at LIMIT 1');
  return row ? fromRow(row) : null;
}

export async function createChild(
  db: SQLiteDatabase,
  input: { name: string; birthDate: string },
): Promise<Child> {
  const now = Date.now();
  const child: Child = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  await db.runAsync(
    'INSERT INTO child (id, name, birth_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    child.id,
    child.name,
    child.birthDate,
    child.createdAt,
    child.updatedAt,
  );
  return child;
}

export async function updateChild(
  db: SQLiteDatabase,
  id: string,
  input: { name: string; birthDate: string },
): Promise<void> {
  await db.runAsync(
    'UPDATE child SET name = ?, birth_date = ?, updated_at = ? WHERE id = ?',
    input.name,
    input.birthDate,
    Date.now(),
    id,
  );
}
