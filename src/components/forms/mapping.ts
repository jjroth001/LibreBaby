import type { BottleValues } from '@/components/forms/bottle-form';
import type { BreastValues } from '@/components/forms/breast-form';
import type { PumpValues } from '@/components/forms/pump-form';
import type { BabyEvent, EventDataMap } from '@/db/types';
import { manualBreast } from '@/lib/breast';
import { fromMl, toMl, type VolumeUnit } from '@/lib/units';

const MINUTE = 60_000;

export function cleanNotes(notes: string): string | null {
  return notes.trim() || null;
}

// Forms show rounded values (whole minutes, 0.01 oz). When a value comes back unchanged,
// keep the stored precise value so that merely opening and saving an event never drifts it.

export function breastToValues(event: BabyEvent<'feed_breast'>): BreastValues {
  return {
    startAt: event.startAt,
    leftMin: Math.round(event.data.leftMs / MINUTE),
    rightMin: Math.round(event.data.rightMs / MINUTE),
    endedOn: event.data.lastSide,
    notes: event.notes ?? '',
  };
}

export function breastFromValues(
  values: BreastValues,
  original?: BabyEvent<'feed_breast'>,
): { startAt: number; endAt: number; data: EventDataMap['feed_breast'] } {
  const before = original && breastToValues(original);
  const leftMs =
    before && values.leftMin === before.leftMin ? original.data.leftMs : values.leftMin * MINUTE;
  const rightMs =
    before && values.rightMin === before.rightMin
      ? original.data.rightMs
      : values.rightMin * MINUTE;

  // A timed feed's wall-clock span includes pauses; keep it unless the side times changed.
  const durationKept =
    before &&
    original.endAt != null &&
    values.leftMin === before.leftMin &&
    values.rightMin === before.rightMin;
  const endAt = durationKept
    ? values.startAt + (original.endAt! - original.startAt)
    : values.startAt + leftMs + rightMs;

  return { startAt: values.startAt, endAt, data: manualBreast(leftMs, rightMs, values.endedOn) };
}

export function bottleToValues(event: BabyEvent<'feed_bottle'>, unit: VolumeUnit): BottleValues {
  return {
    amount: fromMl(event.data.amountMl, unit),
    content: event.data.content,
    time: event.startAt,
    notes: event.notes ?? '',
  };
}

/** Display amount → ml, keeping `originalMl` exactly when the shown amount wasn't changed. */
function keepMl(amount: number, unit: VolumeUnit, originalMl: number | undefined): number {
  if (originalMl !== undefined && amount === fromMl(originalMl, unit)) return originalMl;
  return toMl(amount, unit);
}

export function bottleAmountMl(
  values: BottleValues,
  unit: VolumeUnit,
  original?: BabyEvent<'feed_bottle'>,
): number {
  return keepMl(values.amount, unit, original?.data.amountMl);
}

export function pumpToValues(event: BabyEvent<'pump'>, unit: VolumeUnit): PumpValues {
  return {
    startAt: event.startAt,
    minutes: Math.round(((event.endAt ?? event.startAt) - event.startAt) / MINUTE),
    leftAmount: fromMl(event.data.leftMl, unit),
    rightAmount: fromMl(event.data.rightMl, unit),
    notes: event.notes ?? '',
  };
}

export function pumpFromValues(
  values: PumpValues,
  unit: VolumeUnit,
  original?: BabyEvent<'pump'>,
): { startAt: number; endAt: number; data: EventDataMap['pump'] } {
  const before = original && pumpToValues(original, unit);
  const durationMs =
    before && values.minutes === before.minutes && original.endAt != null
      ? original.endAt - original.startAt
      : values.minutes * MINUTE;
  return {
    startAt: values.startAt,
    endAt: values.startAt + durationMs,
    data: {
      leftMl: keepMl(values.leftAmount, unit, original?.data.leftMl),
      rightMl: keepMl(values.rightAmount, unit, original?.data.rightMl),
    },
  };
}
