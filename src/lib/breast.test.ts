import {
  finishBreast,
  pauseBreast,
  sideTotals,
  startBreast,
  suggestedNextSide,
  tapSide,
  totalMs,
} from './breast';

const MIN = 60_000;

describe('breast feeding timer', () => {
  it('counts time on the active side', () => {
    const data = startBreast('L', 0);
    expect(sideTotals(data, 5 * MIN)).toEqual({ leftMs: 5 * MIN, rightMs: 0 });
  });

  it('switches sides and keeps both totals', () => {
    let data = startBreast('L', 0);
    data = tapSide(data, 'R', 10 * MIN);
    expect(sideTotals(data, 15 * MIN)).toEqual({ leftMs: 10 * MIN, rightMs: 5 * MIN });
    expect(totalMs(data, 15 * MIN)).toBe(15 * MIN);
  });

  it('tapping the active side pauses, tapping again resumes', () => {
    let data = startBreast('L', 0);
    data = tapSide(data, 'L', 4 * MIN);
    expect(data.activeSide).toBeNull();
    expect(totalMs(data, 60 * MIN)).toBe(4 * MIN); // no time accrues while paused
    data = tapSide(data, 'L', 60 * MIN);
    expect(totalMs(data, 62 * MIN)).toBe(6 * MIN);
  });

  it('finishes with a side summary and the last side used', () => {
    let data = startBreast('L', 0);
    data = tapSide(data, 'R', 8 * MIN);
    const done = finishBreast(data, 12 * MIN);
    expect(done).toMatchObject({
      side: 'both',
      lastSide: 'R',
      leftMs: 8 * MIN,
      rightMs: 4 * MIN,
      activeSide: null,
      activeSince: null,
    });
    expect(suggestedNextSide(done)).toBe('L');
  });

  it('finishes a single-side feed as that side', () => {
    expect(finishBreast(startBreast('R', 0), MIN).side).toBe('R');
  });

  it('pausing twice does not double count', () => {
    const once = pauseBreast(startBreast('L', 0), MIN);
    expect(pauseBreast(once, 10 * MIN)).toEqual(once);
  });

  it('suggests left when there is no history', () => {
    expect(suggestedNextSide(undefined)).toBe('L');
  });
});
