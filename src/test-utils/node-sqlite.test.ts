import { openTestDatabase } from './node-sqlite';

it('builds the full schema with real SQLite', async () => {
  const db = openTestDatabase();
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  expect(tables.map((t) => t.name)).toEqual([
    'child',
    'event',
    'setting',
    'sync_counter',
    'sync_peer',
  ]);
});
