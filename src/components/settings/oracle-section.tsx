import { useSQLiteContext } from 'expo-sqlite';

import { Card } from '@/components/card';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { setSetting, type Settings } from '@/db/settings';
import type { OracleDiapers } from '@/lib/oracle';

const DIAPER_OPTIONS = [
  { value: 'all', label: 'Wet & dirty' },
  { value: 'dirty', label: 'Dirty only' },
] as const satisfies readonly { value: OracleDiapers; label: string }[];

/** Settings › The Oracle: which diapers its agenda predicts. */
export function OracleSection({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  return (
    <Card>
      <ThemedText type="smallBold">Diaper estimates</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Which diapers the Oracle predicts. Wet ones come often, so you may prefer to see only the
        dirty ones.
      </ThemedText>
      <SegmentedControl
        options={DIAPER_OPTIONS}
        value={settings.oracleDiapers}
        onChange={(value) => setSetting(db, 'oracleDiapers', value)}
      />
    </Card>
  );
}
