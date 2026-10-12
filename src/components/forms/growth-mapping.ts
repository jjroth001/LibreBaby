import type { BabyEvent, EventDataMap } from '@/db/types';
import { cmToIn, inToCm, kgToLbOz, lbOzToKg, type GrowthUnits } from '@/lib/growth-units';

/**
 * The growth form edits text, in the parent's units. Imperial weight is pounds
 * (`weightA`) + ounces (`weightB`); metric weight is kilograms in `weightA`.
 */
export type GrowthValues = {
  time: number;
  weightA: string;
  weightB: string;
  length: string;
  head: string;
  notes: string;
};

type GrowthData = EventDataMap['growth'];

// Generous bounds for 0–3 years; anything outside is almost certainly a typo or wrong unit.
const PLAUSIBLE = {
  weightKg: [0.3, 30],
  lengthCm: [25, 120],
  headCm: [20, 60],
} as const;

const fmt = (n: number, places: number) => String(Math.round(n * 10 ** places) / 10 ** places);

export function growthToValues(
  event: Pick<BabyEvent<'growth'>, 'startAt' | 'data' | 'notes'>,
  units: GrowthUnits,
): GrowthValues {
  const { weightKg, lengthCm, headCm } = event.data;
  const imperial = units === 'imperial';
  const lbOz = weightKg !== null && imperial ? kgToLbOz(weightKg) : null;
  const length = (cm: number | null) =>
    cm === null ? '' : imperial ? fmt(cmToIn(cm), 2) : fmt(cm, 1);
  return {
    time: event.startAt,
    weightA: weightKg === null ? '' : lbOz ? String(lbOz.lb) : fmt(weightKg, 3),
    weightB: lbOz ? String(lbOz.oz) : '',
    length: length(lengthCm),
    head: length(headCm),
    notes: event.notes ?? '',
  };
}

function parseNumber(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

/**
 * Text → metric data, or a message explaining what's wrong. Fields left exactly as
 * shown keep their stored value, so opening and saving never drifts a measurement.
 */
export function parseGrowth(
  values: GrowthValues,
  units: GrowthUnits,
  original?: Pick<BabyEvent<'growth'>, 'startAt' | 'data' | 'notes'>,
): { data: GrowthData } | { error: string | null } {
  const before = original ? growthToValues(original, units) : null;
  const imperial = units === 'imperial';

  // Weight
  let weightKg: number | null;
  if (before && values.weightA === before.weightA && values.weightB === before.weightB) {
    weightKg = original!.data.weightKg;
  } else {
    const a = parseNumber(values.weightA);
    const b = imperial ? parseNumber(values.weightB) : null;
    if (a === 'invalid' || b === 'invalid') return { error: 'Weight should be a number.' };
    weightKg = a === null && b === null ? null : imperial ? lbOzToKg(a ?? 0, b ?? 0) : a;
  }

  // Length and head circumference
  const lengthField = (key: 'length' | 'head', stored: number | null) => {
    if (before && values[key] === before[key]) return stored;
    const n = parseNumber(values[key]);
    if (n === 'invalid' || n === null) return n;
    return imperial ? inToCm(n) : n;
  };
  const lengthCm = lengthField('length', original?.data.lengthCm ?? null);
  const headCm = lengthField('head', original?.data.headCm ?? null);
  if (lengthCm === 'invalid') return { error: 'Length should be a number.' };
  if (headCm === 'invalid') return { error: 'Head circumference should be a number.' };

  if (weightKg === null && lengthCm === null && headCm === null) return { error: null };

  const unit = imperial ? { weight: 'lb', length: 'in' } : { weight: 'kg', length: 'cm' };
  const outside = (v: number | null, [lo, hi]: readonly [number, number]) =>
    v !== null && (v < lo || v > hi);
  if (outside(weightKg, PLAUSIBLE.weightKg))
    return { error: `That weight looks off — check it's in ${unit.weight}.` };
  if (outside(lengthCm, PLAUSIBLE.lengthCm))
    return { error: `That length looks off — check it's in ${unit.length}.` };
  if (outside(headCm, PLAUSIBLE.headCm))
    return { error: `That head size looks off — check it's in ${unit.length}.` };

  return { data: { weightKg, lengthCm, headCm } };
}
