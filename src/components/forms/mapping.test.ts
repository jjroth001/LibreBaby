import type { BabyEvent } from '@/db/types';
import { finishBreast, startBreast, tapSide } from '@/lib/breast';

import { bottleAmountMl, bottleToValues, breastFromValues, breastToValues } from './mapping';

const SEC = 1000;
const MIN = 60 * SEC;

function timedFeed(): BabyEvent<'feed_breast'> {
  // 7m40s left, paused 3 minutes, then 4m10s right.
  let data = startBreast('L', 0);
  data = tapSide(data, 'L', 7 * MIN + 40 * SEC); // pause
  data = tapSide(data, 'R', 10 * MIN + 40 * SEC); // resume on right
  const endAt = 14 * MIN + 50 * SEC;
  return {
    id: 'e1',
    childId: 'c1',
    type: 'feed_breast',
    startAt: 0,
    endAt,
    data: finishBreast(data, endAt),
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('breast form mapping', () => {
  it('shows whole minutes per side', () => {
    expect(breastToValues(timedFeed())).toMatchObject({ leftMin: 8, rightMin: 4, endedOn: 'R' });
  });

  it('keeps precise times and the paused span when sides are unchanged', () => {
    const original = timedFeed();
    const values = { ...breastToValues(original), startAt: 60 * MIN, notes: 'sleepy' };
    const result = breastFromValues(values, original);
    expect(result.data.leftMs).toBe(original.data.leftMs);
    expect(result.data.rightMs).toBe(original.data.rightMs);
    expect(result.endAt - result.startAt).toBe(original.endAt! - original.startAt);
  });

  it('uses the edited minutes when a side changes', () => {
    const original = timedFeed();
    const result = breastFromValues({ ...breastToValues(original), rightMin: 6 }, original);
    expect(result.data.rightMs).toBe(6 * MIN);
    expect(result.data.leftMs).toBe(original.data.leftMs);
    expect(result.endAt).toBe(original.data.leftMs + 6 * MIN);
  });

  it('builds new entries from minutes', () => {
    const result = breastFromValues({
      startAt: 0,
      leftMin: 5,
      rightMin: 0,
      endedOn: 'R',
      notes: '',
    });
    expect(result).toMatchObject({ endAt: 5 * MIN, data: { side: 'L', lastSide: 'L' } });
  });
});

describe('bottle form mapping', () => {
  const bottle: BabyEvent<'feed_bottle'> = {
    id: 'b1',
    childId: 'c1',
    type: 'feed_bottle',
    startAt: 0,
    endAt: null,
    data: { amountMl: 120, content: 'formula' },
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  };

  it('keeps the stored ml when the amount is not changed', () => {
    const values = bottleToValues(bottle, 'oz'); // 120 ml shows as 4.1 oz
    expect(bottleAmountMl(values, 'oz', bottle)).toBe(120);
  });

  it('converts an edited amount', () => {
    const values = { ...bottleToValues(bottle, 'oz'), amount: 5 };
    expect(bottleAmountMl(values, 'oz', bottle)).toBeCloseTo(147.87, 1);
  });
});
