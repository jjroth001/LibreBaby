import type { BabyEvent } from '@/db/types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Range = { minMs: number; maxMs: number };

/**
 * Typical time awake between sleeps, by age. These are broad, commonly published
 * ranges from general pediatric sleep guidance — a starting point, not a rule.
 */
const WAKE_WINDOWS: { untilAgeDays: number; minMs: number; maxMs: number }[] = [
  { untilAgeDays: 28, minMs: 35 * MINUTE, maxMs: 60 * MINUTE }, // 0–4 weeks
  { untilAgeDays: 84, minMs: 60 * MINUTE, maxMs: 90 * MINUTE }, // 1–3 months
  { untilAgeDays: 120, minMs: 75 * MINUTE, maxMs: 2 * HOUR }, // 3–4 months
  { untilAgeDays: 150, minMs: 1.75 * HOUR, maxMs: 2.5 * HOUR }, // 4–5 months
  { untilAgeDays: 210, minMs: 2 * HOUR, maxMs: 3 * HOUR }, // 5–7 months
  { untilAgeDays: 300, minMs: 2.5 * HOUR, maxMs: 3.5 * HOUR }, // 7–10 months
  { untilAgeDays: 420, minMs: 3 * HOUR, maxMs: 4 * HOUR }, // 10–14 months
  { untilAgeDays: 730, minMs: 4 * HOUR, maxMs: 6 * HOUR }, // 14–24 months
  { untilAgeDays: Infinity, minMs: 5 * HOUR, maxMs: 6 * HOUR }, // 2 years+
];

export function ageWakeWindow(ageDays: number): Range {
  const row =
    WAKE_WINDOWS.find((w) => ageDays < w.untilAgeDays) ?? WAKE_WINDOWS[WAKE_WINDOWS.length - 1];
  return { minMs: row.minMs, maxMs: row.maxMs };
}

/** Need at least this many recent wake windows before personalizing. */
export const MIN_SAMPLES = 3;
const LOOKBACK_MS = 7 * DAY;
/** Wake-ups in this local-hour range count as daytime; night wakings would skew things short. */
const DAY_STARTS_HOUR = 6;
const DAY_ENDS_HOUR = 20;

/**
 * Daytime awake stretches from the last week: the gap between one sleep ending
 * and the next starting. Implausibly short or long gaps (missed logs) are ignored.
 */
export function recentWakeWindows(sleeps: BabyEvent<'sleep'>[], now: number): number[] {
  const finished = sleeps
    .filter((s) => s.endAt != null && s.endAt > now - LOOKBACK_MS)
    .sort((a, b) => a.startAt - b.startAt);

  const gaps: number[] = [];
  for (let i = 1; i < finished.length; i++) {
    const wokeAt = finished[i - 1].endAt!;
    const gap = finished[i].startAt - wokeAt;
    const hour = new Date(wokeAt).getHours();
    if (hour < DAY_STARTS_HOUR || hour >= DAY_ENDS_HOUR) continue;
    if (gap < 15 * MINUTE || gap > 8 * HOUR) continue;
    gaps.push(gap);
  }
  return gaps;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type SleepPrediction = {
  opensAt: number;
  closesAt: number;
  ageRange: Range;
  /** The child's typical recent wake window, when there was enough data to use it. */
  personalMs: number | null;
};

/**
 * Next sleep window = when they last woke + a wake window. The window keeps the
 * width of the age range; with enough history its center moves halfway toward the
 * child's own median (clamped so one odd week can't push it far off).
 */
export function predictNextSleep(input: {
  ageDays: number;
  lastWokeAt: number;
  recentWindows: number[];
}): SleepPrediction {
  const ageRange = ageWakeWindow(input.ageDays);
  const ageCenter = (ageRange.minMs + ageRange.maxMs) / 2;
  const halfWidth = (ageRange.maxMs - ageRange.minMs) / 2;

  let personalMs: number | null = null;
  let center = ageCenter;
  if (input.recentWindows.length >= MIN_SAMPLES) {
    personalMs = median(input.recentWindows);
    const clamped = Math.min(Math.max(personalMs, ageRange.minMs * 0.75), ageRange.maxMs * 1.25);
    center = (ageCenter + clamped) / 2;
  }

  return {
    opensAt: input.lastWokeAt + center - halfWidth,
    closesAt: input.lastWokeAt + center + halfWidth,
    ageRange,
    personalMs,
  };
}
