import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import { Spacing } from '@/constants/theme';
import type { DaySummary } from '@/lib/day-summary';
import { formatDuration } from '@/lib/format';
import { formatVolume, type VolumeUnit } from '@/lib/units';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function DayTotals({ summary, unit }: { summary: DaySummary; unit: VolumeUnit }) {
  const feedDetail = [
    summary.bottleMl > 0 && `${formatVolume(summary.bottleMl, unit)} bottle`,
    summary.breastMs > 0 && `${formatDuration(summary.breastMs)} breast`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <StatTile
        title="Sleep"
        value={summary.sleepMs > 0 ? formatDuration(summary.sleepMs) : '0'}
        detail={summary.sleepCount ? plural(summary.sleepCount, 'sleep') : undefined}
      />
      <StatTile title="Feeds" value={String(summary.feedCount)} detail={feedDetail || undefined} />
      <StatTile
        title="Diapers"
        value={String(summary.diaperCount)}
        detail={
          summary.diaperCount ? `${summary.wetCount} wet · ${summary.dirtyCount} dirty` : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
