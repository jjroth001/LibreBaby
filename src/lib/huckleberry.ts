import type { EventDataMap, EventType } from '@/db/types';

import { manualBreast } from './breast';
import { parseCsv } from './csv';
import { ML_PER_OZ } from './units';

/**
 * Reads Huckleberry's CSV export ("Type, Start, End, Duration, Start Condition,
 * Start Location, End Condition, Notes, Logged By"). Huckleberry reuses the condition
 * and location columns differently per entry type, so each type has its own reader
 * below. Values carry their own units/side tags (00:14R, 2.5oz, 13.03lbs.oz, 40cm),
 * which we parse rather than trusting column positions. Anything unreadable is
 * skipped and reported — never guessed.
 */

export type ImportedEvent<T extends EventType = EventType> = {
  [K in T]: {
    /** Stable per-row key, so importing the same file twice doesn't duplicate entries. */
    sourceKey: string;
    type: K;
    startAt: number;
    endAt: number | null;
    data: EventDataMap[K];
    notes: string | null;
  };
}[T];

export type HuckleberryParse = {
  events: ImportedEvent[];
  /** Rows not imported, grouped by reason, e.g. { "Bath (not tracked in LibreBaby)": 2 }. */
  skipped: Record<string, number>;
  /** Count of imported entries per LibreBaby type, for the confirmation summary. */
  counts: Partial<Record<EventType, number>>;
};

const HEADER = [
  'Type',
  'Start',
  'End',
  'Duration',
  'Start Condition',
  'Start Location',
  'End Condition',
  'Notes',
];

const MINUTE = 60_000;
const LB_TO_KG = 0.45359237;
const CM_PER_IN = 2.54;
const CM_PER_FT = 30.48;

/**
 * Pump amounts aren't tagged with a side: Start Condition is the left side and End
 * Condition the right (confirmed against an entry in the Huckleberry app). Note this is
 * the opposite of feeds, whose tagged times put the right side first ("00:14R").
 */
const PUMP_START_CONDITION_SIDE: 'L' | 'R' = 'L';

// --- Field readers ------------------------------------------------------------

/** "2026-10-12 03:16" (local time) → ms, or null. */
export function parseHbTime(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/** "03:13" (hours:minutes) → ms, or null. */
function parseHoursMinutes(value: string): number | null {
  const m = /^(\d+):(\d{2})$/.exec(value.trim());
  return m ? (Number(m[1]) * 60 + Number(m[2])) * MINUTE : null;
}

/** "00:14R" → { side: 'R', ms }, or null. */
function parseSideTime(value: string): { side: 'L' | 'R'; ms: number } | null {
  const m = /^(\d+):(\d{2})\s*([LR])$/i.exec(value.trim());
  if (!m) return null;
  return { side: m[3].toUpperCase() as 'L' | 'R', ms: (Number(m[1]) * 60 + Number(m[2])) * MINUTE };
}

/** "1.25oz" / "30ml" → ml, or null. */
export function parseVolume(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(oz|ml)$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 'oz' ? n * ML_PER_OZ : n;
}

/**
 * Weight → kg. Huckleberry labels imperial weights "lbs.oz" but the number is decimal
 * pounds (e.g. "8.88lbs.oz" — 88 can't be ounces); a real export's checkups only form a
 * smooth growth curve when read that way.
 */
export function parseWeight(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(lbs?(?:\.oz)?|kg|g)$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return unit.startsWith('lb') ? n * LB_TO_KG : unit === 'kg' ? n : n / 1000;
}

/** Length → cm. "ft.in" values are decimal feet (e.g. "1.92ft.in" = 23.0 in), like weight. */
export function parseLength(value: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(ft(?:\.in)?|in|cm|mm)$/i.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('ft')) return n * CM_PER_FT;
  if (unit === 'in') return n * CM_PER_IN;
  return unit === 'cm' ? n : n / 10;
}

/** "10-20_minutes, happy" → "10-20 minutes, happy". */
const tidy = (value: string) => value.trim().replace(/_/g, ' ');

const joinNotes = (...parts: (string | false | null | undefined)[]) => {
  const text = parts.filter((p): p is string => !!p && p.trim() !== '').join(' · ');
  return text || null;
};

// --- Row readers ---------------------------------------------------------------

type Row = {
  type: string;
  start: string;
  end: string;
  duration: string;
  startCondition: string;
  startLocation: string;
  endCondition: string;
  notes: string;
};

type Result = ImportedEvent | { skip: string };

function endOf(row: Row, startAt: number): number | null {
  const end = parseHbTime(row.end);
  if (end !== null) return end;
  const duration = parseHoursMinutes(row.duration);
  return duration !== null ? startAt + duration : null;
}

function readFeed(row: Row, startAt: number, key: string): Result {
  const location = row.startLocation.toLowerCase();
  if (location.includes('breast')) {
    const sides = [parseSideTime(row.startCondition), parseSideTime(row.endCondition)];
    const leftMs = sides.reduce((sum, s) => sum + (s?.side === 'L' ? s.ms : 0), 0);
    const rightMs = sides.reduce((sum, s) => sum + (s?.side === 'R' ? s.ms : 0), 0);
    if (leftMs + rightMs === 0) return { skip: 'Breastfeeds with no time on either side' };
    const endAt = endOf(row, startAt) ?? startAt + leftMs + rightMs;
    // Huckleberry doesn't record which side came last; with both, assume the longer one.
    const endedOn = rightMs > leftMs ? 'R' : 'L';
    return {
      sourceKey: key,
      type: 'feed_breast',
      startAt,
      endAt,
      data: manualBreast(leftMs, rightMs, endedOn),
      notes: joinNotes(row.notes),
    };
  }
  if (location.includes('bottle')) {
    const amountMl = [row.startCondition, row.endCondition, row.duration]
      .map(parseVolume)
      .find((v) => v !== null);
    if (amountMl == null) return { skip: 'Bottle feeds without a readable amount' };
    const all = `${row.startCondition} ${row.endCondition} ${row.notes}`.toLowerCase();
    return {
      sourceKey: key,
      type: 'feed_bottle',
      startAt,
      endAt: null,
      data: { amountMl, content: all.includes('formula') ? 'formula' : 'breast_milk' },
      notes: joinNotes(row.notes),
    };
  }
  return { skip: `Feeds of type "${row.startLocation || 'unknown'}" (not recognized)` };
}

function readDiaper(row: Row, startAt: number, key: string): Result {
  // End Condition: "Pee", "Poo", "Both", optionally with sizes: "Both, pee:large poo:small".
  const kind = row.endCondition.toLowerCase();
  const both = kind.startsWith('both');
  const wet = both || kind.startsWith('pee');
  const dirty = both || kind.startsWith('poo');
  if (!wet && !dirty) return { skip: 'Diapers without pee/poo recorded' };
  const sizes = row.endCondition
    .split(',')
    .slice(1)
    .join(' ')
    .replace(/(pee|poo):/gi, '$1 ')
    .trim();
  return {
    sourceKey: key,
    type: 'diaper',
    startAt,
    endAt: null,
    data: { wet, dirty },
    // Huckleberry puts poo color in the Duration column and consistency in Start Condition.
    notes: joinNotes(tidy(row.duration), tidy(row.startCondition), sizes, row.notes),
  };
}

function readSleep(row: Row, startAt: number, key: string): Result {
  const endAt = endOf(row, startAt);
  if (endAt === null || endAt <= startAt) return { skip: 'Sleeps without an end time' };
  return {
    sourceKey: key,
    type: 'sleep',
    startAt,
    endAt,
    data: {},
    notes: joinNotes(
      row.startCondition && `Falling asleep: ${tidy(row.startCondition)}`,
      row.startLocation && `Where: ${tidy(row.startLocation)}`,
      row.endCondition && `Waking: ${tidy(row.endCondition)}`,
      row.notes,
    ),
  };
}

function readPump(row: Row, startAt: number, key: string): Result {
  const first = parseVolume(row.startCondition) ?? 0;
  const second = parseVolume(row.endCondition) ?? 0;
  const [leftMl, rightMl] = PUMP_START_CONDITION_SIDE === 'L' ? [first, second] : [second, first];
  return {
    sourceKey: key,
    type: 'pump',
    startAt,
    endAt: endOf(row, startAt) ?? startAt,
    data: { leftMl, rightMl },
    notes: joinNotes(row.notes),
  };
}

function readMeds(row: Row, startAt: number, key: string): Result {
  const name = row.startLocation.trim();
  if (!name) return { skip: 'Medications without a name' };
  return {
    sourceKey: key,
    type: 'medication',
    startAt,
    endAt: null,
    data: { name, dose: row.startCondition.trim() },
    notes: joinNotes(row.notes),
  };
}

function readGrowth(row: Row, startAt: number, key: string): Result {
  // Weight in Start Condition, length in Start Location, head in End Condition.
  const weightKg = parseWeight(row.startCondition);
  const lengthCm = parseLength(row.startLocation);
  const headCm = parseLength(row.endCondition);
  if (weightKg === null && lengthCm === null && headCm === null) {
    return { skip: 'Growth entries without readable measurements' };
  }
  return {
    sourceKey: key,
    type: 'growth',
    startAt,
    endAt: null,
    data: { weightKg, lengthCm, headCm },
    notes: joinNotes(row.notes),
  };
}

const READERS: Record<string, (row: Row, startAt: number, key: string) => Result> = {
  feed: readFeed,
  diaper: readDiaper,
  sleep: readSleep,
  pump: readPump,
  meds: readMeds,
  medicine: readMeds,
  growth: readGrowth,
};

/** Parses a Huckleberry CSV export. Throws with a user-facing message if it isn't one. */
export function parseHuckleberryCsv(text: string): HuckleberryParse {
  const [header, ...rows] = parseCsv(text);
  const looksRight = header && HEADER.every((name, i) => header[i]?.trim() === name);
  if (!looksRight) {
    throw new Error(
      'This doesn’t look like a Huckleberry export. In Huckleberry, export your data as CSV and pick that file.',
    );
  }

  const result: HuckleberryParse = { events: [], skipped: {}, counts: {} };
  const skip = (reason: string) => (result.skipped[reason] = (result.skipped[reason] ?? 0) + 1);
  const seenKeys = new Map<string, number>();

  for (const cells of rows) {
    if (cells.every((c) => c.trim() === '')) continue;
    const row: Row = {
      type: cells[0] ?? '',
      start: cells[1] ?? '',
      end: cells[2] ?? '',
      duration: cells[3] ?? '',
      startCondition: cells[4] ?? '',
      startLocation: cells[5] ?? '',
      endCondition: cells[6] ?? '',
      notes: cells[7] ?? '',
    };
    const reader = READERS[row.type.trim().toLowerCase()];
    if (!reader) {
      skip(`${row.type.trim() || 'Unknown'} (not tracked in LibreBaby)`);
      continue;
    }
    const startAt = parseHbTime(row.start);
    if (startAt === null) {
      skip('Entries with an unreadable date');
      continue;
    }

    // Two entries of the same type in the same minute (e.g. two diapers) get distinct keys.
    const baseKey = `${row.type.trim()}|${row.start.trim()}`;
    const n = (seenKeys.get(baseKey) ?? 0) + 1;
    seenKeys.set(baseKey, n);

    const read = reader(row, startAt, n === 1 ? baseKey : `${baseKey}#${n}`);
    if ('skip' in read) {
      skip(read.skip);
      continue;
    }
    result.events.push(read);
    result.counts[read.type] = (result.counts[read.type] ?? 0) + 1;
  }
  return result;
}
