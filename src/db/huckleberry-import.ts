import type { SQLiteDatabase } from 'expo-sqlite';

import type { HuckleberryParse, ImportedEvent } from '@/lib/huckleberry';

/** Entries within this long of an existing entry of the same kind count as the same entry. */
const SAME_ENTRY_WINDOW_MS = 5 * 60_000;

const idFor = (event: ImportedEvent) => `huckleberry:${event.sourceKey}`;

export type HuckleberryImportResult = {
  added: number;
  /** Already imported from Huckleberry earlier (same file or an overlapping one). */
  alreadyImported: number;
  /** Matched something you'd already logged in LibreBaby around the same time. */
  matchedExisting: number;
};

type Existing = { id: string; type: string; start_at: number };

/**
 * Decides which parsed Huckleberry entries to add. Pure, for testing.
 * - Rows keep a stable id from their Huckleberry type + start time, so importing the
 *   same export again (or a newer, overlapping one) adds nothing twice.
 * - An entry of the same kind already in LibreBaby within 5 minutes is assumed to be
 *   the same event logged in both apps during the switch, and is skipped.
 */
export function planHuckleberryImport(
  existing: Existing[],
  events: ImportedEvent[],
): { toAdd: ImportedEvent[]; alreadyImported: number; matchedExisting: number } {
  const existingIds = new Set(existing.map((e) => e.id));
  const startsByType = new Map<string, number[]>();
  for (const e of existing) {
    if (e.id.startsWith('huckleberry:')) continue;
    const list = startsByType.get(e.type) ?? [];
    list.push(e.start_at);
    startsByType.set(e.type, list);
  }

  const toAdd: ImportedEvent[] = [];
  let alreadyImported = 0;
  let matchedExisting = 0;
  for (const event of events) {
    if (existingIds.has(idFor(event))) {
      alreadyImported++;
    } else if (
      (startsByType.get(event.type) ?? []).some(
        (start) => Math.abs(start - event.startAt) <= SAME_ENTRY_WINDOW_MS,
      )
    ) {
      matchedExisting++;
    } else {
      toAdd.push(event);
    }
  }
  return { toAdd, alreadyImported, matchedExisting };
}

export async function importHuckleberry(
  db: SQLiteDatabase,
  childId: string,
  parsed: HuckleberryParse,
): Promise<HuckleberryImportResult> {
  // Deleted entries count too: something you deleted after importing stays deleted.
  const existing = await db.getAllAsync<Existing>(
    'SELECT id, type, start_at FROM event WHERE child_id = ?',
    childId,
  );
  const plan = planHuckleberryImport(existing, parsed.events);

  await db.withTransactionAsync(async () => {
    for (const event of plan.toAdd) {
      // Timestamps use the entry's own time (not "now"), so a later backup merge treats
      // an untouched imported entry as older than any edit you make to it.
      await db.runAsync(
        `INSERT INTO event (id, child_id, type, start_at, end_at, data, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        idFor(event),
        childId,
        event.type,
        event.startAt,
        event.endAt,
        JSON.stringify(event.data),
        event.notes,
        event.startAt,
        event.startAt,
      );
    }
  });

  return {
    added: plan.toAdd.length,
    alreadyImported: plan.alreadyImported,
    matchedExisting: plan.matchedExisting,
  };
}
