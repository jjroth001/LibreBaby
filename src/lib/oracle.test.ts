import type { BabyEvent } from '@/db/types';

import { buildForecast, earlierToday, type OracleItem } from './oracle';

const MIN = 60_000;

let nextId = 0;
function base<T extends BabyEvent['type']>(type: T, startAt: number, endAt: number | null) {
  return {
    id: String(nextId++),
    childId: 'c',
    type,
    startAt,
    endAt,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };
}
const sleep = (startAt: number, endAt: number | null) =>
  ({ ...base('sleep', startAt, endAt), data: {} }) as BabyEvent;
const bottle = (startAt: number) =>
  ({
    ...base('feed_bottle', startAt, null),
    data: { amountMl: 120, content: 'formula' },
  }) as BabyEvent;
const diaper = (startAt: number) =>
  ({ ...base('diaper', startAt, null), data: { wet: true, dirty: false } }) as BabyEvent;

/** Local time on day `d` of October 2026 (made-up dates). */
function at(d: number, hour: number, minute = 0): number {
  return new Date(2026, 9, d, hour, minute).getTime();
}

/** A steady routine: up at 6:50, four naps, bed at 7:30 PM, two night feeds. */
function routineDay(d: number): BabyEvent[] {
  return [
    sleep(at(d, 8, 45), at(d, 9, 45)),
    sleep(at(d, 11, 45), at(d, 12, 45)),
    sleep(at(d, 14, 45), at(d, 15, 30)),
    sleep(at(d, 17, 15), at(d, 17, 45)),
    sleep(at(d, 19, 30), at(d, 23, 30)),
    sleep(at(d, 23, 50), at(d + 1, 3, 30)),
    sleep(at(d + 1, 3, 50), at(d + 1, 6, 50)),
    ...[7, 10, 13, 16, 19].map((h) => bottle(at(d, h))),
    bottle(at(d, 23, 35)),
    bottle(at(d + 1, 3, 35)),
    ...[7, 10, 13, 16, 19].map((h) => diaper(at(d, h, 10))),
    diaper(at(d, 23, 40)),
  ];
}

/** Oct 1–14 of the routine, and Oct 15 up to early afternoon. */
function history(): BabyEvent[] {
  const events: BabyEvent[] = [];
  for (let d = 1; d <= 14; d++) events.push(...routineDay(d));
  events.push(
    sleep(at(15, 8, 45), at(15, 9, 45)),
    sleep(at(15, 11, 45), at(15, 12, 45)),
    ...[7, 10, 13].map((h) => bottle(at(15, h))),
    ...[7, 10, 13].map((h) => diaper(at(15, h, 10))),
  );
  return events;
}

const AGE = 110;
const kinds = (items: OracleItem[]) => items.map((i) => (i.night ? `night-${i.kind}` : i.kind));
const near = (actual: number, expected: number, toleranceMin = 20) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(toleranceMin * MIN);

describe('buildForecast on a steady routine', () => {
  const now = at(15, 14);
  const forecast = buildForecast({ events: history(), ageDays: AGE, now });
  const of = (kind: string, night = false) =>
    forecast.items.filter((i) => i.kind === kind && i.night === night);

  it('knows the child is awake and has enough history', () => {
    expect(forecast.awakeSince).toBe(at(15, 12, 45));
    expect(forecast.asleepSince).toBeNull();
    expect(forecast.learning).toBe(false);
  });

  it('outlines the rest of the day in time order, through to tomorrow morning', () => {
    const times = forecast.items.map((i) => i.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(forecast.items.every((i) => i.at >= now)).toBe(true);
    expect(kinds(forecast.items).at(-2)).toBe('wake');
    expect(kinds(forecast.items).at(-1)).toBe('feed');
  });

  it('predicts naps from the usual awake time, then bedtime', () => {
    const naps = of('nap');
    expect(naps.length).toBe(2);
    near(naps[0].at, at(15, 14, 35));
    expect(naps[0].confidence).toBe('likely');
    const [bedtime] = of('bedtime');
    near(bedtime.at, at(15, 19, 30), 5);
    expect(bedtime.confidence).toBe('likely');
  });

  it('spaces day feeds by the usual gap and never during a nap', () => {
    const feeds = of('feed');
    near(feeds[0].at, at(15, 16), 5);
    for (const feed of feeds) {
      for (const nap of of('nap')) expect(feed.at > nap.at && feed.at < nap.endAt!).toBe(false);
    }
  });

  it('predicts two night feeds, a night change and the morning wake-up', () => {
    const nightFeeds = of('feed', true);
    expect(nightFeeds.length).toBe(2);
    near(nightFeeds[0].at, at(15, 23, 35), 10);
    near(nightFeeds[1].at, at(16, 3, 35), 10);
    expect(of('diaper', true).length).toBe(1);
    near(of('wake')[0].at, at(16, 6, 50), 5);
  });

  it('explains every estimate', () => {
    for (const item of forecast.items) {
      expect(item.reasons.length).toBeGreaterThan(0);
      expect(item.from).toBeLessThanOrEqual(item.at);
      expect(item.to).toBeGreaterThanOrEqual(item.at);
    }
  });
});

describe('buildForecast in other situations', () => {
  it('during a nap, starts with when the nap should end', () => {
    const events = [...history(), sleep(at(15, 14, 30), null)];
    const forecast = buildForecast({ events, ageDays: AGE, now: at(15, 14, 50) });
    expect(forecast.asleepSince).toBe(at(15, 14, 30));
    expect(forecast.items[0].kind).toBe('nap-end');
    expect(forecast.items.some((i) => i.kind === 'bedtime')).toBe(true);
  });

  it('after bedtime, shows only the night and the morning', () => {
    const events = [...history(), ...routineDay(15).filter((e) => e.startAt <= at(15, 19, 30))];
    // Bedtime is still running.
    const night = events.find((e) => e.startAt === at(15, 19, 30))!;
    night.endAt = null;
    const forecast = buildForecast({ events, ageDays: AGE, now: at(15, 22) });
    expect(kinds(forecast.items)).toEqual([
      'night-feed',
      'night-diaper',
      'night-feed',
      'wake',
      'feed',
    ]);
  });

  it('awake in the night, expects them to settle again', () => {
    const events = [
      ...history(),
      ...routineDay(15).filter((e) => e.startAt < at(15, 19, 30)),
      sleep(at(15, 19, 30), at(16, 1, 50)),
    ];
    const forecast = buildForecast({ events, ageDays: AGE, now: at(16, 2) });
    // Woke well past the usual first night feed: feed now, then settle.
    expect(forecast.items[0]).toMatchObject({ kind: 'feed', night: true, due: true });
    expect(kinds(forecast.items)).toContain('night-back-to-sleep');
    expect(forecast.items.some((i) => i.kind === 'nap')).toBe(false);
  });

  it('up for the day after a night, plans the day rather than the night', () => {
    const events = [...history(), ...routineDay(15)];
    const forecast = buildForecast({ events, ageDays: AGE, now: at(16, 7, 30) });
    expect(forecast.items[0].kind).not.toBe('back-to-sleep');
    expect(forecast.items.some((i) => i.kind === 'nap')).toBe(true);
    near(forecast.items.find((i) => i.kind === 'bedtime')!.at, at(16, 19, 30), 5);
  });

  it('with no history, falls back to age-typical ranges and says "maybe"', () => {
    const forecast = buildForecast({ events: [], ageDays: AGE, now: at(15, 10) });
    expect(forecast.learning).toBe(true);
    expect(forecast.items.length).toBeGreaterThan(0);
    expect(forecast.items.every((i) => i.confidence === 'maybe')).toBe(true);
    expect(forecast.items.some((i) => i.kind === 'bedtime')).toBe(true);
    expect(forecast.items.some((i) => i.kind === 'wake')).toBe(true);
  });

  it('marks a feed that is already overdue as due now', () => {
    const events = history().filter((e) => !(e.type === 'feed_bottle' && e.startAt === at(15, 13)));
    const now = at(15, 14);
    const forecast = buildForecast({ events, ageDays: AGE, now });
    const feed = forecast.items.find((i) => i.kind === 'feed')!;
    expect(feed.due).toBe(true);
    expect(feed.at).toBe(now);
  });
});

describe('earlierToday', () => {
  it('counts sleeps (including the end of the night), feedings and changes since midnight', () => {
    const summary = earlierToday(history(), at(15, 14));
    expect(summary).toMatchObject({ sleeps: 3, feeds: 4, diapers: 3 });
  });
});
