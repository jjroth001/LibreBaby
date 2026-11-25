import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import { categoryColors } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import type { BabyEvent } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { describeEventShort } from '@/lib/describe';
import { formatDuration } from '@/lib/format';
import type { VolumeUnit } from '@/lib/units';

type LastEventsProps = {
  now: number;
  unit: VolumeUnit;
  sleeping: boolean;
  lastSleep: BabyEvent<'sleep'> | null;
  lastFeed: BabyEvent | null;
  lastDiaper: BabyEvent | null;
};

/** "Awake for / last feed / last diaper" at a glance. */
export function LastEvents({
  now,
  unit,
  sleeping,
  lastSleep,
  lastFeed,
  lastDiaper,
}: LastEventsProps) {
  const theme = useTheme();
  const color = (category: 'sleep' | 'feed' | 'diaper') => categoryColors(theme, category).bar;
  const sleepTile = sleeping
    ? { value: 'Asleep', detail: 'Timer running' }
    : lastSleep?.endAt
      ? {
          value: formatDuration(now - lastSleep.endAt),
          detail: describeEventShort(lastSleep, unit),
        }
      : null;

  return (
    <View style={styles.row}>
      <StatTile
        icon="timer"
        title="Awake"
        value={sleepTile?.value}
        detail={sleepTile?.detail}
        iconColor={color('sleep')}
      />
      <StatTile
        icon="bottle"
        title="Fed"
        iconColor={color('feed')}
        value={lastFeed && `${formatDuration(now - lastFeed.startAt)} ago`}
        detail={lastFeed ? describeEventShort(lastFeed, unit) : undefined}
        // A long breast feed ("L 1h 5m · R 1h 2m") can wrap; keep the "Last:" line visible.
        detailLines={3}
      />
      <StatTile
        icon="diaper"
        title="Diaper"
        iconColor={color('diaper')}
        value={lastDiaper && `${formatDuration(now - lastDiaper.startAt)} ago`}
        detail={lastDiaper ? describeEventShort(lastDiaper, unit) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
