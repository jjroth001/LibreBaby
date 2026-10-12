import { sunTimes } from './sun';

const MIN = 60_000;
const utc = (y: number, mo: number, d: number, h: number, mi: number) =>
  Date.UTC(y, mo - 1, d, h, mi);

/** Published (NOAA / timeanddate) times; the formula is good to ~2 minutes. */
const CASES: [string, [number, number, number], number, number, number, number][] = [
  // New York, June solstice: 5:25 AM EDT / 8:31 PM EDT
  [
    'New York, June',
    [2026, 6, 21],
    40.7128,
    -74.006,
    utc(2026, 6, 21, 9, 25),
    utc(2026, 6, 22, 0, 31),
  ],
  // London, December solstice: 8:04 / 15:54 GMT
  [
    'London, December',
    [2026, 12, 21],
    51.5074,
    -0.1278,
    utc(2026, 12, 21, 8, 4),
    utc(2026, 12, 21, 15, 54),
  ],
  // Phoenix, March equinox: 6:30 AM / 6:38 PM MST (UTC-7)
  [
    'Phoenix, March',
    [2026, 3, 20],
    33.4484,
    -112.074,
    utc(2026, 3, 20, 13, 30),
    utc(2026, 3, 21, 1, 38),
  ],
  // Sydney, January: 6:00 AM / 8:09 PM AEDT (UTC+11)
  [
    'Sydney, January',
    [2026, 1, 15],
    -33.8688,
    151.2093,
    utc(2026, 1, 14, 19, 0),
    utc(2026, 1, 15, 9, 9),
  ],
];

describe('sunTimes', () => {
  it.each(CASES)('%s', (_name, [y, m, d], lat, lon, sunrise, sunset) => {
    const times = sunTimes(y, m, d, lat, lon);
    if (times.kind !== 'normal') throw new Error(`unexpected ${times.kind}`);
    expect(Math.abs(times.sunrise - sunrise)).toBeLessThanOrEqual(3 * MIN);
    expect(Math.abs(times.sunset - sunset)).toBeLessThanOrEqual(3 * MIN);
  });

  it('reports polar night and midnight sun', () => {
    expect(sunTimes(2026, 12, 21, 69.65, 18.96).kind).toBe('always-down'); // Tromsø
    expect(sunTimes(2026, 6, 21, 69.65, 18.96).kind).toBe('always-up');
  });
});
