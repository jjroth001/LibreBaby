import type { BabyEvent } from '@/db/types';

import { describeEventShort } from './describe';

const event = (type: string, data: object, endAt: number | null = null) =>
  ({ id: 'e', childId: 'c', type, startAt: 0, endAt, data, notes: null }) as unknown as BabyEvent;

describe('describeEventShort', () => {
  it('keeps Home tile details short', () => {
    expect(
      describeEventShort(event('feed_bottle', { amountMl: 120, content: 'formula' }), 'ml'),
    ).toBe('Bottle 120 ml');
    expect(
      describeEventShort(event('feed_breast', { leftMs: 12 * 60_000, rightMs: 9 * 60_000 }), 'oz'),
    ).toBe('Breast\nL 12m, R 9m');
    expect(describeEventShort(event('feed_breast', { leftMs: 0, rightMs: 9 * 60_000 }), 'oz')).toBe(
      'Breast\nR 9m',
    );
    expect(describeEventShort(event('diaper', { wet: true, dirty: false }), 'oz')).toBe('Wet');
    expect(describeEventShort(event('diaper', { wet: true, dirty: true }), 'oz')).toBe(
      'Wet + dirty',
    );
    expect(describeEventShort(event('feed_solids', { foods: ['pear'] }), 'oz')).toBe('Solids');
  });

  it('falls back to the full label', () => {
    expect(describeEventShort(event('sleep', {}, 40 * 60_000), 'oz')).toBe('Slept 40m');
  });
});
