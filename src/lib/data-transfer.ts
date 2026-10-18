import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createBackup, parseBackup, type Backup, type EventRow } from '@/db/backup';
import type { BabyEvent, EventType } from '@/db/types';

import { toCsv } from './csv';
import { toLocalDateString } from './dates';
import { describeEvent } from './describe';
import { formatTime } from './format';
import { parseHuckleberryCsv, type HuckleberryParse } from './huckleberry';
import type { GrowthUnits } from './growth-units';
import type { VolumeUnit } from './units';

/** Every file we share starts with this, so leftovers can be found and removed. */
const SHARE_PREFIX = 'librebaby-';

/**
 * How long a shared copy stays after the share sheet closes. Most apps read it before then,
 * but some (Drive, for one) finish reading it just after.
 */
const SHARED_COPY_LIFETIME_MS = 60_000;

/** Deletes shared copies left in the cache (the app was closed before they were removed). */
function removeSharedCopies() {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof File && entry.name.startsWith(SHARE_PREFIX)) entry.delete();
    }
  } catch {
    // Best effort: the cache is cleared by Android when space runs low anyway.
  }
}

/**
 * Writes `contents` to a cache file and opens Android's share sheet (Drive, email, Files…).
 * The copy holds the whole baby log, so it's deleted again soon after the sheet closes.
 */
async function shareFile(name: string, contents: string, mimeType: string, dialogTitle: string) {
  removeSharedCopies();
  const file = new File(Paths.cache, name);
  file.create();
  file.write(contents);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
  } finally {
    setTimeout(() => {
      try {
        if (file.exists) file.delete();
      } catch {
        // Picked up by removeSharedCopies next time.
      }
    }, SHARED_COPY_LIFETIME_MS);
  }
}

function today() {
  return toLocalDateString(new Date());
}

export async function shareBackup(db: SQLiteDatabase): Promise<void> {
  const backup = await createBackup(db);
  await shareFile(
    `librebaby-backup-${today()}.json`,
    JSON.stringify(backup),
    'application/json',
    'Save LibreBaby backup',
  );
}

const TYPE_LABELS: Record<EventType, string> = {
  sleep: 'Sleep',
  feed_breast: 'Breastfeed',
  feed_bottle: 'Bottle',
  feed_solids: 'Solids',
  diaper: 'Diaper',
  medication: 'Medication',
  pump: 'Pumping',
  growth: 'Growth',
  milestone: 'Milestone',
};

/** All entries as a spreadsheet, oldest first — handy for a pediatrician visit. */
export async function shareSpreadsheet(
  db: SQLiteDatabase,
  unit: VolumeUnit,
  growthUnits: GrowthUnits,
): Promise<void> {
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM event WHERE deleted_at IS NULL ORDER BY start_at',
  );
  const header = ['Date', 'Start', 'End', 'Minutes', 'Type', 'Details', 'Notes'];
  // An entry that can't be read is left out rather than failing the whole export.
  const lines = rows.flatMap((row) => {
    try {
      return [toLine(row)];
    } catch {
      return [];
    }
  });
  function toLine(row: EventRow) {
    const event = {
      id: row.id,
      childId: row.child_id,
      type: row.type,
      startAt: row.start_at,
      endAt: row.end_at,
      data: JSON.parse(row.data),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as BabyEvent;
    return [
      toLocalDateString(new Date(event.startAt)),
      formatTime(event.startAt),
      event.endAt ? formatTime(event.endAt) : '',
      event.endAt ? Math.round((event.endAt - event.startAt) / 60_000) : '',
      TYPE_LABELS[event.type] ?? event.type,
      describeEvent(event, unit, growthUnits),
      event.notes,
    ];
  }
  await shareFile(
    `librebaby-entries-${today()}.csv`,
    toCsv([header, ...lines]),
    'text/csv',
    'Export LibreBaby entries',
  );
}

/**
 * Reads a file the user just picked. Expo Go's file access is sandboxed per project and
 * refuses the picker's cached copy ("Missing 'READ' permission"); fetch reads it fine, so
 * fall back to that. Installed builds take the first path.
 */
async function readPickedFile(uri: string): Promise<string> {
  try {
    return await new File(uri).text();
  } catch (error) {
    const response = await fetch(uri).catch(() => null);
    if (!response) throw error;
    return response.text();
  }
}

/** Real backups and exports are a few MB at most; anything far bigger isn't one. */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** Throws a readable error for a file too big to be a backup or export (unknown size passes). */
export function checkImportSize(bytes: number | null | undefined): void {
  if (typeof bytes === 'number' && bytes > MAX_IMPORT_BYTES) {
    throw new Error(
      `This file is ${Math.round(bytes / (1024 * 1024))} MB, too big to be a LibreBaby backup or a Huckleberry export.`,
    );
  }
}

/** The picked file's size in bytes, if the picker or the file system can tell. */
function pickedSize(asset: DocumentPicker.DocumentPickerAsset): number | null {
  if (typeof asset.size === 'number') return asset.size;
  try {
    return new File(asset.uri).size;
  } catch {
    return null;
  }
}

/** Checks the size, reads the file, then removes the picker's cache copy of it. */
async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  checkImportSize(pickedSize(asset));
  try {
    return await readPickedFile(asset.uri);
  } finally {
    try {
      const copy = new File(asset.uri);
      if (copy.exists) copy.delete();
    } catch {
      // Expo Go can't touch it; Android clears the cache eventually.
    }
  }
}

/** Lets the user pick a Huckleberry CSV export. Returns null if they cancel; throws if it isn't one. */
export async function pickHuckleberryExport(): Promise<HuckleberryParse | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // CSVs show up under several MIME types depending on where they're stored.
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const text = await readPicked(result.assets[0]);
  return parseHuckleberryCsv(text);
}

/** Lets the user pick a backup file. Returns null if they cancel; throws if it's not valid. */
export async function pickBackup(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Some file managers label .json files as plain text or generic binary.
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const text = await readPicked(result.assets[0]);
  return parseBackup(text);
}
