import type { BreastSide, EventDataMap } from '@/db/types';

export type BreastData = EventDataMap['feed_breast'];

export function startBreast(side: BreastSide, now: number): BreastData {
  return { side, lastSide: side, leftMs: 0, rightMs: 0, activeSide: side, activeSince: now };
}

/** Per-side totals including the segment in progress. */
export function sideTotals(data: BreastData, now: number): { leftMs: number; rightMs: number } {
  const running =
    data.activeSide && data.activeSince != null ? Math.max(0, now - data.activeSince) : 0;
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
  const side =
    leftMs > 0 && rightMs > 0 ? 'both' : rightMs > 0 ? 'R' : leftMs > 0 ? 'L' : data.lastSide;
  return { ...paused, side };
}

/**
 * Data for a feed entered after the fact. `endedOn` only matters when both sides
 * were used; with one side, that side is where it ended.
 */
export function manualBreast(leftMs: number, rightMs: number, endedOn: BreastSide): BreastData {
  const lastSide = leftMs > 0 && rightMs > 0 ? endedOn : rightMs > 0 ? 'R' : 'L';
  return finishBreast(
    { side: lastSide, lastSide, leftMs, rightMs, activeSide: null, activeSince: null },
    0,
  );
}
