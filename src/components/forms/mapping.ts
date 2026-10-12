import type { BottleValues } from '@/components/forms/bottle-form';
import type { BreastValues } from '@/components/forms/breast-form';
import type { BabyEvent, EventDataMap } from '@/db/types';
import { manualBreast } from '@/lib/breast';
import { fromMl, toMl, type VolumeUnit } from '@/lib/units';

const MINUTE = 60_000;

export function cleanNotes(notes: string): string | null {
  return notes.trim() || null;
}

// Forms show rounded values (whole minutes, 0.1 oz). When a value comes back unchanged,
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

export function bottleAmountMl(
  values: BottleValues,
  unit: VolumeUnit,
  original?: BabyEvent<'feed_bottle'>,
): number {
  if (original && values.amount === fromMl(original.data.amountMl, unit))
    return original.data.amountMl;
  return toMl(values.amount, unit);
}
