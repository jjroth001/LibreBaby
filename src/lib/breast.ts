import type { BreastSide, EventDataMap } from '@/db/types';

export type BreastData = EventDataMap['feed_breast'];

export function otherSide(side: BreastSide): BreastSide {
  return side === 'L' ? 'R' : 'L';
}

export function startBreast(side: BreastSide, now: number): BreastData {
  return { side, lastSide: side, leftMs: 0, rightMs: 0, activeSide: side, activeSince: now };
}

/** Per-side totals including the segment in progress. */
export function sideTotals(data: BreastData, now: number): { leftMs: number; rightMs: number } {
  const running = data.activeSide && data.activeSince != null ? Math.max(0, now - data.activeSince) : 0;
  return {
    leftMs: data.leftMs + (data.activeSide === 'L' ? running : 0),
    rightMs: data.rightMs + (data.activeSide === 'R' ? running : 0),
  };
}

export function totalMs(data: BreastData, now: number): number {
  const { leftMs, rightMs } = sideTotals(data, now);
  return leftMs + rightMs;
}

/** Folds the running segment into the side totals and stops the clock. */
export function pauseBreast(data: BreastData, now: number): BreastData {
  return { ...data, ...sideTotals(data, now), activeSide: null, activeSince: null };
}

/** Tapping a side: pauses it if it's running, otherwise switches to (or resumes on) it. */
export function tapSide(data: BreastData, side: BreastSide, now: number): BreastData {
  const paused = pauseBreast(data, now);
  if (data.activeSide === side) return paused;
  return { ...paused, lastSide: side, activeSide: side, activeSince: now };
}

/** Final data to save when the feed ends. */
export function finishBreast(data: BreastData, now: number): BreastData {
  const paused = pauseBreast(data, now);
  const { leftMs, rightMs } = paused;
  const side = leftMs > 0 && rightMs > 0 ? 'both' : rightMs > 0 ? 'R' : leftMs > 0 ? 'L' : data.lastSide;
  return { ...paused, side };
}

/** The side to start the next feed on: the opposite of where the last feed ended. */
export function suggestedNextSide(last: BreastData | undefined): BreastSide {
  return last ? otherSide(last.lastSide) : 'L';
}
