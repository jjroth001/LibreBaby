import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
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

  // Less frequent things get a line of their own, only on days they happened.
  const extras = [
    summary.pumpCount > 0 &&
      `🥛 Pumped ${formatVolume(summary.pumpMl, unit)} (${plural(summary.pumpCount, 'session')})`,
    summary.medicationCount > 0 && `💊 ${plural(summary.medicationCount, 'medication')}`,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <StatTile
          title="Sleep"
          value={summary.sleepMs > 0 ? formatDuration(summary.sleepMs) : '0'}
          detail={summary.sleepCount ? plural(summary.sleepCount, 'sleep') : undefined}
        />
        <StatTile
          title="Feeds"
          value={String(summary.feedCount)}
          detail={feedDetail || undefined}
        />
        <StatTile
          title="Diapers"
          value={String(summary.diaperCount)}
          detail={
            summary.diaperCount
              ? `${summary.wetCount} wet · ${summary.dirtyCount} dirty`
              : undefined
          }
        />
      </View>
      {extras.length > 0 && (
        <ThemedText themeColor="textSecondary">{extras.join('  ·  ')}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
});
