import { WHO_LMS, type LmsRow, type Measure, type Sex } from '@/data/who-growth';

export type { Measure, Sex };

/** Average days per month, as used by WHO to convert age in days to months. */
export const DAYS_PER_MONTH = 30.4375;
export const MAX_CHART_MONTHS = 24;

/** WHO LMS parameters at a (fractional) age in months, interpolated between whole months. */
export function lmsAt(measure: Measure, sex: Sex, ageMonths: number): LmsRow | null {
  if (ageMonths < 0 || ageMonths > MAX_CHART_MONTHS) return null;
  const table = WHO_LMS[measure][sex];
  const lo = Math.floor(ageMonths);
  const hi = Math.min(lo + 1, MAX_CHART_MONTHS);
  const t = ageMonths - lo;
  const [L0, M0, S0] = table[lo];
  const [L1, M1, S1] = table[hi];
  return [L0 + (L1 - L0) * t, M0 + (M1 - M0) * t, S0 + (S1 - S0) * t];
}

/** How many standard deviations `value` is from the WHO median (LMS method). */
export function zScore(value: number, [L, M, S]: LmsRow): number {
  if (Math.abs(L) < 1e-9) return Math.log(value / M) / S;
  return ((value / M) ** L - 1) / (L * S);
}

/** The measurement at a given z-score (inverse of `zScore`). */
export function valueAtZ(z: number, [L, M, S]: LmsRow): number {
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
  return M * (1 + L * S * z) ** (1 / L);
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf; error < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Percentile (0–100) of a measurement for a child of this age and sex, or null past 24 months. */
export function percentileFor(
  measure: Measure,
  sex: Sex,
  ageMonths: number,
  value: number,
): number | null {
  const lms = lmsAt(measure, sex, ageMonths);
  return lms ? normalCdf(zScore(value, lms)) * 100 : null;
}

/** "48th percentile", with the extremes stated plainly rather than as "0th"/"100th". */
export function formatPercentile(p: number): string {
  if (p < 1) return 'below the 1st percentile';
  if (p > 99) return 'above the 99th percentile';
  const n = Math.round(p);
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${suffix} percentile`;
}

/** z-scores of the reference curves we draw: 3rd, 15th, 50th, 85th and 97th percentiles. */
export const CURVE_Z = { p3: -1.8808, p15: -1.0364, p50: 0, p85: 1.0364, p97: 1.8808 } as const;

export type CurvePoint = { ageMonths: number } & Record<keyof typeof CURVE_Z, number>;

/** Reference curves sampled every `step` months from 0 to `toMonths`. */
export function referenceCurves(
  measure: Measure,
  sex: Sex,
  toMonths: number,
  step = 0.25,
): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let age = 0; age <= toMonths + 1e-9; age += step) {
    const lms = lmsAt(measure, sex, age)!;
    points.push({
      ageMonths: age,
      p3: valueAtZ(CURVE_Z.p3, lms),
      p15: valueAtZ(CURVE_Z.p15, lms),
      p50: valueAtZ(CURVE_Z.p50, lms),
      p85: valueAtZ(CURVE_Z.p85, lms),
      p97: valueAtZ(CURVE_Z.p97, lms),
    });
  }
  return points;
}
