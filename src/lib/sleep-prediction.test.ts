import type { BabyEvent } from '@/db/types';

import { ageWakeWindow, predictNextSleep, recentWakeWindows } from './sleep-prediction';

const MIN = 60_000;
const HOUR = 60 * MIN;

function sleep(startAt: number, endAt: number | null): BabyEvent<'sleep'> {
  return {
    id: String(startAt),
    childId: 'c',
    type: 'sleep',
    startAt,
    endAt,
    data: {},
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Local time on Oct 11, 2026. */
function at(hour: number, minute = 0): number {
  return new Date(2026, 9, 11, hour, minute).getTime();
}

describe('ageWakeWindow', () => {
  it.each([
    [0, 35 * MIN, 60 * MIN],
    [27, 35 * MIN, 60 * MIN],
    [28, 60 * MIN, 90 * MIN],
    [180, 2 * HOUR, 3 * HOUR],
    [3000, 5 * HOUR, 6 * HOUR],
  ])('age %i days → %i–%i ms', (ageDays, minMs, maxMs) => {
    expect(ageWakeWindow(ageDays)).toEqual({ minMs, maxMs });
  });
});

describe('recentWakeWindows', () => {
  it('measures daytime gaps between sleeps', () => {
    const sleeps = [
      sleep(at(9), at(10)), // woke 10:00
      sleep(at(12), at(13)), // 2h later; woke 13:00
      sleep(at(15, 30), at(16)), // 2.5h later
    ];
    expect(recentWakeWindows(sleeps, at(18))).toEqual([2 * HOUR, 2.5 * HOUR]);
  });

  it('ignores night wakings, implausible gaps and running sleeps', () => {
    const sleeps = [
      sleep(at(1), at(2)), // woke at 2am: night, skipped
      sleep(at(2, 10), at(5)), // 5am wake, next sleep 9h later: skipped (also too long)
      sleep(at(14), at(15)), // 15:00 wake
      sleep(at(15, 5), at(16)), // 5 min gap: skipped (too short)
      sleep(at(18), null), // running: not a finished sleep
    ];
    expect(recentWakeWindows(sleeps, at(19))).toEqual([]);
  });
});

describe('predictNextSleep', () => {
  const sixMonths = 180; // 2–3h window

  it('uses the age range until there is enough history', () => {
    const p = predictNextSleep({ ageDays: sixMonths, lastWokeAt: at(10), recentWindows: [HOUR] });
    expect(p.opensAt).toBe(at(12));
    expect(p.closesAt).toBe(at(13));
    expect(p.personalMs).toBeNull();
  });

  it('moves halfway toward the child’s own median', () => {
    // Median 3.5h; age center 2.5h → blended center 3h, window 2.5–3.5h.
    const p = predictNextSleep({
      ageDays: sixMonths,
      lastWokeAt: at(10),
      recentWindows: [3 * HOUR, 3.5 * HOUR, 4 * HOUR],
    });
    expect(p.personalMs).toBe(3.5 * HOUR);
    expect(p.opensAt).toBe(at(12, 30));
    expect(p.closesAt).toBe(at(13, 30));
  });

  it('limits how far an unusual week can pull the estimate', () => {
    // Median 8h is clamped to 3.75h (1.25 × 3h max) → center 3.125h.
    const p = predictNextSleep({
      ageDays: sixMonths,
      lastWokeAt: at(8),
      recentWindows: [8 * HOUR, 8 * HOUR, 8 * HOUR],
    });
    expect(p.opensAt - at(8)).toBe(3.125 * HOUR - 0.5 * HOUR);
  });
});
