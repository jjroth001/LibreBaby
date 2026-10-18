import { useSQLiteContext } from 'expo-sqlite';

import { Card } from '@/components/card';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { setSetting, type Settings } from '@/db/settings';

const VOLUME_OPTIONS = [
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'ml', label: 'Milliliters (ml)' },
] as const;

const GROWTH_UNIT_OPTIONS = [
  { value: 'imperial', label: 'lb & in' },
  { value: 'metric', label: 'kg & cm' },
] as const;

/** Settings › Units: bottles and pumping, and growth measurements. */
export function UnitsSection({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  return (
    <Card>
      <ThemedText type="smallBold">Bottles and pumping</ThemedText>
      <SegmentedControl
        options={VOLUME_OPTIONS}
        value={settings.volumeUnit}
        onChange={(unit) => setSetting(db, 'volumeUnit', unit)}
      />
      <ThemedText type="smallBold">Weight, length and head size</ThemedText>
      <SegmentedControl
        options={GROWTH_UNIT_OPTIONS}
        value={settings.growthUnits}
        onChange={(units) => setSetting(db, 'growthUnits', units)}
      />
    </Card>
  );
}
