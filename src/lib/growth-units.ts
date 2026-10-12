export type GrowthUnits = 'imperial' | 'metric';

const KG_PER_LB = 0.45359237;
const OZ_PER_LB = 16;
const CM_PER_IN = 2.54;

/** kg → whole pounds + ounces (to the nearest 0.1 oz), carrying 16 oz into a pound. */
export function kgToLbOz(kg: number): { lb: number; oz: number } {
  const totalOz = Math.round((kg / KG_PER_LB) * OZ_PER_LB * 10) / 10;
  const lb = Math.floor(totalOz / OZ_PER_LB);
  return { lb, oz: Math.round((totalOz - lb * OZ_PER_LB) * 10) / 10 };
}

export function lbOzToKg(lb: number, oz: number): number {
  return (lb + oz / OZ_PER_LB) * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** "15 lb 14 oz" or "7.2 kg". */
export function formatWeight(kg: number, units: GrowthUnits): string {
  if (units === 'metric') return `${round(kg, 2)} kg`;
  const { lb, oz } = kgToLbOz(kg);
  return `${lb} lb ${oz} oz`;
}

/** "25.6 in" or "65 cm" (one decimal). */
export function formatLength(cm: number, units: GrowthUnits): string {
  return units === 'metric' ? `${round(cm, 1)} cm` : `${round(cmToIn(cm), 1)} in`;
}

/** Chart axis value: weight in lb or kg, length in inches or cm. */
export function toDisplayNumber(
  value: number,
  kind: 'weight' | 'length',
  units: GrowthUnits,
): number {
  if (units === 'metric') return value;
  return kind === 'weight' ? value / KG_PER_LB : cmToIn(value);
}
