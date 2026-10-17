import type { BabyEvent, Child } from '@/db/types';

import { SCENES } from '@/lib/sky';

import { buildWidgetModel, widgetAgo, widgetRefreshMinutes, widgetTime } from './widget-model';

const child: Child = {
  id: 'c',
  name: 'Ada',
  birthDate: '2026-06-01',
  sex: 'female',
  createdAt: 0,
  updatedAt: 0,
};
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();
const now = at(12, 15);

const bottle = {
  id: 'f',
  childId: 'c',
  type: 'feed_bottle',
  startAt: at(12, 14, 10),
  endAt: null,
  data: { amountMl: 118.29, content: 'formula' },
  notes: null,
  createdAt: 0,
  updatedAt: 0,
} as BabyEvent;

const base = {
  child,
  lastFeed: null,
  lastDiaper: null,
  sleep: { status: 'no-data' } as const,
  timers: [],
  unit: 'oz' as const,
  growthUnits: 'imperial' as const,
  now,
  scene: SCENES.day,
};

describe('widget model', () => {
  it('is empty before a profile exists', () => {
    expect(buildWidgetModel({ ...base, child: null })).toEqual({
      kind: 'empty',
      scene: SCENES.day,
    });
  });

  it('shows time since the last feed, the next sleep window, and the last diaper', () => {
    const model = buildWidgetModel({
      ...base,
      lastFeed: bottle,
      sleep: {
        status: 'awake',
        lastWokeAt: at(12, 13),
        prediction: {
          opensAt: at(12, 15, 30),
          closesAt: at(12, 16),
          ageRange: { minMs: 0, maxMs: 0 },
          personalMs: null,
        },
      },
    });
    expect(model).toMatchObject({ kind: 'ready', childName: 'Ada' });
    if (model.kind !== 'ready') throw new Error('expected ready');
    const [feed, sleep, diaper] = model.rows;
    expect(feed.label).toBe('Last feed');
    expect(feed.value).toBe('50m ago');
    expect(feed.detail).toMatch(/^2:10.* · Bottle · 4 oz formula$/);
    expect(sleep.label).toBe('Next sleep');
    expect(sleep.value).toMatch(/3:30.*–.*4:00/);
    expect(diaper).toMatchObject({ value: '—', detail: 'Nothing logged yet' });
  });

  it('says when the baby is asleep', () => {
    const model = buildWidgetModel({
      ...base,
      sleep: { status: 'sleeping', since: at(12, 13, 5) },
    });
    if (model.kind !== 'ready') throw new Error('expected ready');
    expect(model.rows[1].label).toBe('Asleep since');
    expect(model.rows[1].value).toMatch(/1:05/);
  });

  it('shows a running sleep as a timer, and redraws every minute while it runs', () => {
    const sleep = {
      ...bottle,
      id: 's',
      type: 'sleep',
      startAt: at(12, 13, 48),
      data: {},
    } as BabyEvent<'sleep'>;
    const model = buildWidgetModel({ ...base, timers: [sleep] });
    if (model.kind !== 'ready') throw new Error('expected ready');
    expect(model.timer).toMatchObject({ kind: 'sleep', eventId: 's', elapsed: '1h 12m' });
    expect(model.timer?.kind === 'sleep' && model.timer.since).toMatch(/1:48/);
    expect(widgetRefreshMinutes(model)).toBe(1);
    expect(widgetRefreshMinutes(buildWidgetModel(base))).toBe(10);
  });

  it('shows a breastfeed per side, preferring the most recently started timer', () => {
    const sleep = {
      ...bottle,
      id: 's',
      type: 'sleep',
      startAt: at(12, 13),
      data: {},
    } as BabyEvent<'sleep'>;
    const feed = {
      ...bottle,
      id: 'b',
      type: 'feed_breast',
      startAt: at(12, 14, 48),
      data: {
        side: 'L',
        lastSide: 'L',
        leftMs: 0,
        rightMs: 4 * 60_000,
        activeSide: 'L',
        activeSince: at(12, 14, 52),
      },
    } as BabyEvent<'feed_breast'>;
    const model = buildWidgetModel({ ...base, timers: [sleep, feed] });
    if (model.kind !== 'ready') throw new Error('expected ready');
    expect(model.timer).toEqual({
      kind: 'breast',
      eventId: 'b',
      left: '8m',
      right: '4m',
      activeSide: 'L',
      lastSide: 'L',
    });
  });

  it('says "Just now" for the first minute', () => {
    expect(widgetAgo(now - 30_000, now)).toBe('Just now');
    expect(widgetAgo(now - 2 * 3_600_000, now)).toBe('2h ago');
  });

  it('adds the weekday for anything before today', () => {
    expect(widgetTime(at(11, 21), now)).toMatch(/^\S+ 9:00/); // "Sun 9:00 PM"
    expect(widgetTime(at(12, 9), now)).not.toMatch(/^[A-Za-z]{3} /);
  });
});
