import type { BabyEvent } from '@/db/types';

import { describeEventShort } from './describe';

const event = (type: string, data: object, endAt: number | null = null) =>
  ({ id: 'e', childId: 'c', type, startAt: 0, endAt, data, notes: null }) as unknown as BabyEvent;

describe('describeEventShort', () => {
  it('keeps Home tile details short', () => {
    expect(
      describeEventShort(event('feed_bottle', { amountMl: 120, content: 'formula' }), 'ml'),
    ).toBe('Bottle 120 ml');
    const breast = (leftMin: number, rightMin: number, lastSide?: string) =>
      describeEventShort(
        event('feed_breast', { leftMs: leftMin * 60_000, rightMs: rightMin * 60_000, lastSide }),
        'oz',
      );
    expect(breast(12, 9, 'R')).toBe('L 12m · R 9m\nLast: right');
    expect(breast(12, 0, 'L')).toBe('L 12m\nLast: left');
    expect(breast(0, 0, 'L')).toBe('Breast');
    // Odd data (say, from an import) still shows the sides.
    expect(breast(12, 9)).toBe('Breast · L 12m · R 9m');
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
