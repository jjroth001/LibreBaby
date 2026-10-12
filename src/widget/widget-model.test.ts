import type { BabyEvent, Child } from '@/db/types';

import { buildWidgetModel, widgetTime } from './widget-model';

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
  unit: 'oz' as const,
  growthUnits: 'imperial' as const,
  now,
};

describe('widget model', () => {
  it('is empty before a profile exists', () => {
    expect(buildWidgetModel({ ...base, child: null })).toEqual({ kind: 'empty' });
  });

  it('shows last feed, next sleep window and last diaper as clock times', () => {
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
    expect(feed.value).toMatch(/2:10/);
    expect(feed.detail).toBe('Bottle · 4 oz formula');
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

  it('adds the weekday for anything before today', () => {
    expect(widgetTime(at(11, 21), now)).toMatch(/^\S+ 9:00/); // "Sun 9:00 PM"
    expect(widgetTime(at(12, 9), now)).not.toMatch(/^[A-Za-z]{3} /);
  });
});
