import type { SQLiteDatabase } from 'expo-sqlite';

import type { GrowthUnits } from '@/lib/growth-units';
import type { VolumeUnit } from '@/lib/units';

export type Settings = {
  volumeUnit: VolumeUnit;
  /** Weight, length and head size: lb/oz + inches, or kg + cm. */
  growthUnits: GrowthUnits;
  /** Notify shortly before the predicted sleep window opens. */
  sleepReminders: boolean;
  /** How many minutes before the window opens to notify. */
  sleepReminderLeadMin: number;
  /** When a backup was last shared from this phone (unix ms). */
  lastBackupAt: number | null;
};

function defaultSettings(): Settings {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const imperial = /-(US|LR|MM)\b/.test(locale);
  return {
    volumeUnit: imperial ? 'oz' : 'ml',
    growthUnits: imperial ? 'imperial' : 'metric',
    sleepReminders: false,
    sleepReminderLeadMin: 15,
    lastBackupAt: null,
  };
}

/** All settings, with defaults filled in for anything never set. Values are stored as JSON. */
export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM setting',
  );
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
