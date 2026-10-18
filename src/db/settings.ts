import type { SQLiteDatabase } from 'expo-sqlite';

import type { GrowthUnits } from '@/lib/growth-units';
import type { MedReminder } from '@/lib/med-reminders';
import type { VolumeUnit } from '@/lib/units';

export type Settings = {
  volumeUnit: VolumeUnit;
  /** Weight, length and head size: lb/oz + inches, or kg + cm. */
  growthUnits: GrowthUnits;
  /** Notify shortly before the predicted sleep window opens. */
  sleepReminders: boolean;
  /** How many minutes before the window opens to notify. */
  sleepReminderLeadMin: number;
  /** Medicine reminders on this phone (see lib/med-reminders.ts). */
  medReminders: MedReminder[];
  /** Keep family sync running while the app is closed (a quiet ongoing notification). */
  backgroundSync: boolean;
  /** Ongoing notification with a live clock while a sleep or feed timer runs. */
  timerNotifications: boolean;
  /** When a backup was last shared from this phone (unix ms). */
  lastBackupAt: number | null;
  /**
   * The look: glass over a sky that follows the time of day, the same always at night
   * (easier on the eyes at 3 AM), or Simple — solid colors following the phone's light or
   * dark mode.
   */
  appearance: 'sky' | 'night' | 'simple';
  /** Accessibility: more opaque panels and full-strength secondary text. */
  highContrast: boolean;
  /** Accessibility: no animations, even if Android's own setting is off. */
  reduceMotion: boolean;
  /** Small vibrations when logging. */
  haptics: boolean;
  /**
   * Rounded (~10 km) location for local sunrise/sunset; only set after the user opts in,
   * never leaves the phone (not synced, not in backups).
   */
  skyLocation: SkyLocation | null;
};

export type SkyLocation = { lat: number; lon: number; updatedAt: number };

function defaultSettings(): Settings {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const imperial = /-(US|LR|MM)\b/.test(locale);
  return {
    volumeUnit: imperial ? 'oz' : 'ml',
    growthUnits: imperial ? 'imperial' : 'metric',
    sleepReminders: false,
    sleepReminderLeadMin: 15,
    medReminders: [],
    timerNotifications: true,
    backgroundSync: true,
    lastBackupAt: null,
    appearance: 'sky',
    highContrast: false,
    reduceMotion: false,
    haptics: true,
    skyLocation: null,
  };
}

/** All settings, with defaults filled in for anything never set. Values are stored as JSON. */
export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM setting',
  );
  const stored: Partial<Settings> = {};
  for (const row of rows) {
    // A value that can't be read falls back to the default instead of breaking every screen.
    try {
      (stored as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch {}
  }
  return { ...defaultSettings(), ...stored };
}

/** Whether `key` is a setting this version of the app has. */
export function isKnownSetting(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(defaultSettings(), key);
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
