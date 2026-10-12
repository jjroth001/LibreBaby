import type { SQLiteDatabase } from 'expo-sqlite';

import type { VolumeUnit } from '@/lib/units';

export type Settings = {
  volumeUnit: VolumeUnit;
};

function defaultSettings(): Settings {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return { volumeUnit: /-(US|LR|MM)\b/.test(locale) ? 'oz' : 'ml' };
}

/** All settings, with defaults filled in for anything never set. Values are stored as JSON. */
export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM setting');
  const stored = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  return { ...defaultSettings(), ...stored };
}

export async function setSetting<K extends keyof Settings>(
  db: SQLiteDatabase,
  key: K,
  value: Settings[K],
): Promise<void> {
  await db.runAsync(
    'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}
