import { StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons/icon';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DaySummary } from '@/lib/day-summary';
import { formatDuration } from '@/lib/format';
import { formatVolume, type VolumeUnit } from '@/lib/units';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function DayTotals({ summary, unit }: { summary: DaySummary; unit: VolumeUnit }) {
  const theme = useTheme();
  const feedDetail = [
    summary.bottleMl > 0 && `${formatVolume(summary.bottleMl, unit)} bottle`,
    summary.breastMs > 0 && `${formatDuration(summary.breastMs)} breast`,
  ]
    .filter(Boolean)
    .join(' · ');

  // Less frequent things get a line of their own, only on days they happened.
  const extras: { icon: IconName; text: string }[] = [];
  if (summary.pumpCount > 0) {
    extras.push({
      icon: 'pump',
      text: `Pumped ${formatVolume(summary.pumpMl, unit)} (${plural(summary.pumpCount, 'session')})`,
    });
  }
  if (summary.medicationCount > 0) {
    extras.push({ icon: 'pill', text: plural(summary.medicationCount, 'medication') });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <StatTile
          icon="moon-stars"
          title="Sleep"
          value={summary.sleepMs > 0 ? formatDuration(summary.sleepMs) : '0'}
          detail={summary.sleepCount ? plural(summary.sleepCount, 'sleep') : undefined}
        />
        <StatTile
          icon="bottle"
          title="Feeds"
          value={String(summary.feedCount)}
          detail={feedDetail || undefined}
        />
        <StatTile
          icon="diaper"
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
        <View style={styles.extras}>
          {extras.map((extra) => (
            <Glass key={extra.icon} radius={18} blur={false} style={styles.chip}>
              <Icon name={extra.icon} size={16} color={theme.accent} />
              <ThemedText type="small">{extra.text}</ThemedText>
            </Glass>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
