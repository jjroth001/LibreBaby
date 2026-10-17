import type { BabyEvent } from '@/db/types';
import type { Forecast, OracleItem } from '@/lib/oracle';
import { SCENES } from '@/lib/sky';

import {
  buildFedModel,
  buildSleepTileModel,
  buildUpNextModel,
  ringSvg,
  UP_NEXT_COUNT,
} from './extra-models';

const at = (hour: number, minute = 0) => new Date(2026, 9, 12, hour, minute).getTime();
const now = at(15);
const scene = SCENES.night;

function item(id: string, kind: OracleItem['kind'], time: number, extra: Partial<OracleItem> = {}) {
  return {
    id,
    kind,
    at: time,
    from: time,
    to: time,
    endAt: null,
    confidence: 'likely',
    night: false,
    due: false,
    reasons: [],
    ...extra,
  } as OracleItem;
}

const forecast = (items: OracleItem[]): Forecast => ({
  now,
  asleepSince: null,
  awakeSince: at(14),
  learning: false,
  daysOfData: 14,
  items,
});

describe('Up next', () => {
  it('lists the next few estimates in time order, "Now" when due', () => {
    const model = buildUpNextModel(
      scene,
      'Robin',
      forecast([
        item('d', 'diaper', at(15, 30), { confidence: 'maybe' }),
        item('n', 'nap', at(15), { due: true, endAt: at(16) }),
        item('f', 'feed', at(17, 30)),
        item('b', 'bedtime', at(19, 30)),
        item('x', 'feed', at(22), { night: true }),
      ]),
    );
    if (model.kind !== 'ready') throw new Error('expected ready');
    expect(model.items).toHaveLength(UP_NEXT_COUNT);
    expect(model.items.map((i) => i.name)).toEqual(['Nap', 'Diaper', 'Feed', 'Bedtime']);
    expect(model.items[0]).toMatchObject({ time: 'Now', icon: 'moon', confidence: 'likely' });
    expect(model.items[1].time).toMatch(/3:30/);
    expect(model.items[1].confidence).toBe('maybe');
  });

  it('is empty before a profile exists', () => {
    expect(buildUpNextModel(scene, null, null)).toEqual({ kind: 'empty', scene });
  });
});

const event = (type: string, startAt: number, data: object) =>
  ({
    id: type,
    childId: 'c',
    type,
    startAt,
    endAt: startAt + 15 * 60_000,
    data,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  }) as BabyEvent;

describe('Last feed tile', () => {
  const breast = event('feed_breast', at(12, 50), {
    side: 'both',
    lastSide: 'R',
    leftMs: 0,
    rightMs: 0,
    activeSide: null,
    activeSince: null,
  }) as BabyEvent<'feed_breast'>;
  const base = { scene, hasChild: true, breastfeeding: false, now };

  it('shows time since the last feed and the side to start on next', () => {
    const bottle = event('feed_bottle', at(13), { amountMl: 120, content: 'formula' });
    const model = buildFedModel({ ...base, lastFeed: bottle, lastBreast: breast });
    expect(model).toMatchObject({ kind: 'ready', value: '2h', nextSide: 'Left' });
    expect(model.kind === 'ready' && model.detail).toMatch(/^ago · 1:00/);
  });

  it('leaves out the side when the last breastfeed was over a day ago', () => {
    const old = { ...breast, startAt: now - 25 * 3_600_000 };
    expect(buildFedModel({ ...base, lastFeed: old, lastBreast: old })).toMatchObject({
      nextSide: null,
    });
  });

  it('says "Now" while breastfeeding, and handles no feeds yet', () => {
    expect(
      buildFedModel({ ...base, lastFeed: null, lastBreast: null, breastfeeding: true }),
    ).toMatchObject({ value: 'Now', detail: 'Breastfeeding' });
    expect(buildFedModel({ ...base, lastFeed: null, lastBreast: null })).toMatchObject({
      value: '—',
      detail: 'No feeds yet',
    });
  });
});

describe('Next sleep tile', () => {
  const awake = (opensAt: number, closesAt: number) =>
    ({
      status: 'awake',
      lastWokeAt: at(14),
      prediction: { opensAt, closesAt, ageRange: { minMs: 0, maxMs: 0 }, personalMs: null },
    }) as const;

  it('counts down to the window with a ring filling up', () => {
    const model = buildSleepTileModel(scene, true, awake(at(15, 30), at(16)), now);
    expect(model).toMatchObject({ value: '30m', footer: 'Awake 1h', progress: 2 / 3 });
    expect(model.kind === 'ready' && model.detail).toMatch(/^at 3:30/);
  });

  it('says "Now" inside the window and "Due" after it, with a full ring', () => {
    expect(buildSleepTileModel(scene, true, awake(at(14, 45), at(15, 15)), now)).toMatchObject({
      value: 'Now',
      progress: 1,
    });
    expect(buildSleepTileModel(scene, true, awake(at(14, 15), at(14, 45)), now)).toMatchObject({
      value: 'Due',
      progress: 1,
    });
  });

  it('shows how long the baby has slept, without a ring', () => {
    expect(
      buildSleepTileModel(scene, true, { status: 'sleeping', since: at(13, 48) }, now),
    ).toMatchObject({ title: 'Asleep', value: '1h 12m', progress: null });
  });

  it('draws a ring: just the track when empty, an arc otherwise', () => {
    expect(ringSvg(0, 100, '#111111', '#FFFFFF')).not.toContain('<path');
    expect(ringSvg(0.25, 100, '#111111', '#FFFFFF')).toContain(' 0 0 1 ');
    expect(ringSvg(0.75, 100, '#111111', '#FFFFFF')).toContain(' 0 1 1 ');
    expect(ringSvg(1, 100, '#111111', '#FFFFFF')).toContain('<path');
  });
});
