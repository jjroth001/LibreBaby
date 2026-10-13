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

/** Writes `contents` to a cache file and opens Android's share sheet (Drive, email, Files…). */
async function shareFile(name: string, contents: string, mimeType: string, dialogTitle: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
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
  const lines = rows.map((row) => {
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
  });
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

/** Lets the user pick a Huckleberry CSV export. Returns null if they cancel; throws if it isn't one. */
export async function pickHuckleberryExport(): Promise<HuckleberryParse | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // CSVs show up under several MIME types depending on where they're stored.
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const text = await readPickedFile(result.assets[0].uri);
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
  const text = await readPickedFile(result.assets[0].uri);
  return parseBackup(text);
}
