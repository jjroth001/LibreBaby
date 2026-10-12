import { cmToIn, formatLength, formatWeight, inToCm, kgToLbOz, lbOzToKg } from './growth-units';

describe('growth units', () => {
  it('converts pounds and ounces both ways', () => {
    const kg = lbOzToKg(15, 14);
    expect(kg).toBeCloseTo(7.2008, 3);
    expect(kgToLbOz(kg)).toEqual({ lb: 15, oz: 14 });
  });

  it('carries 16 oz into a pound instead of showing "7 lb 16 oz"', () => {
    expect(kgToLbOz(lbOzToKg(7, 15.99))).toEqual({ lb: 8, oz: 0 });
  });

  it('keeps tenths of an ounce', () => {
    expect(kgToLbOz(lbOzToKg(9, 4.5))).toEqual({ lb: 9, oz: 4.5 });
  });

  it('converts inches and cm', () => {
    expect(inToCm(10)).toBeCloseTo(25.4, 10);
    expect(cmToIn(inToCm(24.75))).toBeCloseTo(24.75, 10);
  });

  it('formats for display', () => {
    expect(formatWeight(lbOzToKg(15, 14), 'imperial')).toBe('15 lb 14 oz');
    expect(formatWeight(7.2008, 'metric')).toBe('7.2 kg');
    expect(formatLength(65.04, 'metric')).toBe('65 cm');
    expect(formatLength(inToCm(25.6), 'imperial')).toBe('25.6 in');
  });
});
