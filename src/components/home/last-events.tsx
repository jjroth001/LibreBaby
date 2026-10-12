import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/stat-tile';
import { Spacing } from '@/constants/theme';
import type { BabyEvent } from '@/db/types';
import { describeEvent } from '@/lib/describe';
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
  const sleepTile = sleeping
    ? { value: 'Asleep', detail: 'Timer running' }
    : lastSleep?.endAt
      ? { value: formatDuration(now - lastSleep.endAt), detail: describeEvent(lastSleep, unit) }
      : null;

  return (
    <View style={styles.row}>
      <StatTile title="Awake" value={sleepTile?.value} detail={sleepTile?.detail} />
      <StatTile
        title="Last feed"
        value={lastFeed && `${formatDuration(now - lastFeed.startAt)} ago`}
        detail={lastFeed ? describeEvent(lastFeed, unit) : undefined}
      />
      <StatTile
        title="Diaper"
        value={lastDiaper && `${formatDuration(now - lastDiaper.startAt)} ago`}
        detail={lastDiaper ? describeEvent(lastDiaper, unit) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
