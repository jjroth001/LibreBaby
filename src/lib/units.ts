export type VolumeUnit = 'ml' | 'oz';

export const ML_PER_OZ = 29.5735;

/** Stored value (ml) → display value in the chosen unit, rounded for display. */
export function fromMl(ml: number, unit: VolumeUnit): number {
  if (unit === 'ml') return Math.round(ml);
  // Two decimals so quarter-ounce amounts (pumping) display exactly.
  return Math.round((ml / ML_PER_OZ) * 100) / 100;
}

/** Display value in the chosen unit → stored value (ml). */
export function toMl(value: number, unit: VolumeUnit): number {
  return unit === 'ml' ? value : value * ML_PER_OZ;
}

export function formatVolume(ml: number, unit: VolumeUnit): string {
  return `${fromMl(ml, unit)} ${unit}`;
}

/** Pumping is measured more finely than bottles. */
export const PUMP_STEP: Record<VolumeUnit, number> = { oz: 0.25, ml: 5 };

/** Quick-pick amounts and stepper increment, per unit. */
export const VOLUME_PRESETS: Record<VolumeUnit, { quick: number[]; step: number }> = {
  ml: { quick: [30, 60, 90, 120, 150, 180], step: 10 },
  oz: { quick: [1, 2, 3, 4, 5, 6], step: 0.5 },
};
