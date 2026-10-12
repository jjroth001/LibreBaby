import { formatAge } from './dates';
import { formatClock, formatDuration } from './format';
import { fromMl, toMl } from './units';

const MIN = 60_000;

describe('formatDuration', () => {
  it.each([
    [0, '<1m'],
    [59_999, '<1m'],
    [42 * MIN, '42m'],
    [65 * MIN, '1h 5m'],
    [180 * MIN, '3h'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [247_000, '4:07'],
    [42 * MIN + 13_000, '42:13'],
    [62 * MIN + 9_000, '1:02:09'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });
});

describe('units', () => {
  it('round-trips oz through ml', () => {
    expect(fromMl(toMl(4, 'oz'), 'oz')).toBe(4);
    expect(fromMl(toMl(2.5, 'oz'), 'oz')).toBe(2.5);
  });

  it('shows ml as whole numbers', () => {
    expect(fromMl(118.29, 'ml')).toBe(118);
  });
});

describe('formatAge', () => {
  const now = new Date(2026, 9, 11); // Oct 11, 2026
  it.each([
    ['2026-10-11', 'Born today'],
    ['2026-10-06', '5 days'],
    ['2026-09-18', '3 weeks, 2 days'],
    ['2026-09-13', '4 weeks'],
    ['2026-06-04', '4 months, 1 week'],
    ['2025-08-11', '14 months'], // months until 2 years, like pediatric charts
    ['2024-08-11', '2 years, 2 months'],
    ['2026-10-12', 'Not born yet'],
  ])('born %s → %s', (birthDate, expected) => {
    expect(formatAge(birthDate, now)).toBe(expected);
  });
});
