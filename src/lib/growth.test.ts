import { WHO_LMS, type Measure, type Sex } from '@/data/who-growth';
import {
  PERCENTILE_COLUMNS,
  WHO_PUBLISHED_PERCENTILES,
} from '@/data/who-growth-percentiles.fixture';

import { formatPercentile, lmsAt, normalCdf, percentileFor, valueAtZ, zScore } from './growth';

// z-scores of the published columns. The CDC labels z = ±2 as the "2.3rd"/"97.7th".
const Z_FOR_COLUMN: Record<number, number> = {
  2.3: -2,
  5: -1.6448536,
  10: -1.2815516,
  25: -0.6744898,
  50: 0,
  75: 0.6744898,
  90: 1.2815516,
  95: 1.6448536,
  97.7: 2,
};

describe('LMS math against every published WHO percentile value', () => {
  const measures: Measure[] = ['weight', 'length', 'head'];
  const sexes: Sex[] = ['male', 'female'];

  for (const measure of measures) {
    for (const sex of sexes) {
      it(`${measure}, ${sex}: all months and percentile columns match within 0.05%`, () => {
        WHO_LMS[measure][sex].forEach((lms, month) => {
          const published = WHO_PUBLISHED_PERCENTILES[measure][sex][month];
          PERCENTILE_COLUMNS.forEach((column, i) => {
            const computed = valueAtZ(Z_FOR_COLUMN[column], lms);
            expect(Math.abs(computed - published[i]) / published[i]).toBeLessThan(0.0005);
          });
        });
      });
    }
  }
});

describe('z-scores and percentiles', () => {
  it('round-trips value ↔ z', () => {
    const lms = WHO_LMS.weight.male[6];
    for (const z of [-2.5, -1, 0, 0.7, 2.2]) {
      expect(zScore(valueAtZ(z, lms), lms)).toBeCloseTo(z, 8);
    }
  });

  it('puts the median at the 50th percentile', () => {
    const median = WHO_LMS.length.female[3][1];
    expect(percentileFor('length', 'female', 3, median)).toBeCloseTo(50, 5);
  });

  it('has an accurate normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.6448536)).toBeCloseTo(0.95, 6);
    expect(normalCdf(-2)).toBeCloseTo(0.0227501, 6);
  });

  it('interpolates between months', () => {
    const [, m3] = WHO_LMS.weight.female[3];
    const [, m4] = WHO_LMS.weight.female[4];
    expect(lmsAt('weight', 'female', 3.5)![1]).toBeCloseTo((m3 + m4) / 2, 10);
  });

  it('has no reference past 24 months', () => {
    expect(lmsAt('weight', 'male', 24)).not.toBeNull();
    expect(lmsAt('weight', 'male', 24.1)).toBeNull();
    expect(percentileFor('head', 'male', 30, 48)).toBeNull();
  });

  it.each([
    [0.4, 'below the 1st percentile'],
    [1.2, '1st percentile'],
    [2, '2nd percentile'],
    [23, '23rd percentile'],
    [11.4, '11th percentile'],
    [12.6, '13th percentile'],
    [48, '48th percentile'],
    [99.6, 'above the 99th percentile'],
  ])('formats %d as "%s"', (p, text) => {
    expect(formatPercentile(p)).toBe(text);
  });
});
