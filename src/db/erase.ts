import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Permanently deletes the profile, every entry and all settings — "start over".
 * Unlike deleting one entry (a soft delete kept for sync), nothing is kept. VACUUM then
 * rewrites the file so deleted data doesn't linger in free pages on disk.
 */
export async function eraseAllData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM event; DELETE FROM setting; DELETE FROM child;');
  });
  await db.execAsync('VACUUM');
}

/** What would be erased, for the confirmation screen. */
export async function countEntries(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT count(*) AS n FROM event WHERE deleted_at IS NULL',
  );
  return row?.n ?? 0;
}
