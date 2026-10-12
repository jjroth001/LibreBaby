import { inToCm, lbOzToKg } from '@/lib/growth-units';

import { growthToValues, parseGrowth, type GrowthValues } from './growth-mapping';

const blank: GrowthValues = { time: 0, weightA: '', weightB: '', length: '', head: '', notes: '' };

describe('parseGrowth', () => {
  it('reads pounds + ounces and inches', () => {
    const result = parseGrowth(
      { ...blank, weightA: '15', weightB: '14', length: '25.5', head: '16.25' },
      'imperial',
    );
    expect(result).toEqual({
      data: { weightKg: lbOzToKg(15, 14), lengthCm: inToCm(25.5), headCm: inToCm(16.25) },
    });
  });

  it('allows any subset of measurements', () => {
    expect(parseGrowth({ ...blank, weightA: '7,2' }, 'metric')).toEqual({
      data: { weightKg: 7.2, lengthCm: null, headCm: null },
    });
    expect(parseGrowth({ ...blank, weightA: '9' }, 'imperial')).toEqual({
      data: { weightKg: lbOzToKg(9, 0), lengthCm: null, headCm: null },
    });
  });

  it('needs at least one measurement, without nagging before anything is typed', () => {
    expect(parseGrowth(blank, 'metric')).toEqual({ error: null });
  });

  it('catches typos and wrong units', () => {
    expect(parseGrowth({ ...blank, weightA: 'abc' }, 'metric')).toEqual({
      error: 'Weight should be a number.',
    });
    // 155 lb is a typo for 15.5 lb.
    expect(parseGrowth({ ...blank, weightA: '155' }, 'imperial')).toMatchObject({
      error: expect.stringContaining('weight looks off'),
    });
    // 65 "in" is really 65 cm.
    expect(parseGrowth({ ...blank, length: '65' }, 'imperial')).toMatchObject({
      error: expect.stringContaining('in in'),
    });
  });

  it('keeps exact stored values for fields left unchanged', () => {
    const original = {
      startAt: 0,
      notes: null,
      data: { weightKg: 7.2134, lengthCm: 65.43, headCm: 42.17 },
    };
    for (const units of ['imperial', 'metric'] as const) {
      const values = growthToValues(original, units);
      expect(parseGrowth(values, units, original)).toEqual({ data: original.data });
    }
  });

  it('applies an edited field and keeps the others', () => {
    const original = {
      startAt: 0,
      notes: null,
      data: { weightKg: 7.2134, lengthCm: 65.43, headCm: null },
    };
    const values = { ...growthToValues(original, 'metric'), length: '66' };
    expect(parseGrowth(values, 'metric', original)).toEqual({
      data: { weightKg: 7.2134, lengthCm: 66, headCm: null },
    });
  });
});
