import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
export function LastEvents({ now, unit, sleeping, lastSleep, lastFeed, lastDiaper }: LastEventsProps) {
  const sleepTile = sleeping
    ? { value: 'Asleep', detail: 'Timer running' }
    : lastSleep?.endAt
      ? { value: formatDuration(now - lastSleep.endAt), detail: describeEvent(lastSleep, unit) }
      : null;

  return (
    <View style={styles.row}>
      <Tile title="Awake" value={sleepTile?.value} detail={sleepTile?.detail} />
      <Tile
        title="Last feed"
        value={lastFeed && `${formatDuration(now - lastFeed.startAt)} ago`}
        detail={lastFeed ? describeEvent(lastFeed, unit) : undefined}
      />
      <Tile
        title="Diaper"
        value={lastDiaper && `${formatDuration(now - lastDiaper.startAt)} ago`}
        detail={lastDiaper ? describeEvent(lastDiaper, unit) : undefined}
      />
    </View>
  );
}

function Tile({ title, value, detail }: { title: string; value?: string | null; detail?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText style={styles.value}>{value ?? '—'}</ThemedText>
      {detail && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {detail}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  value: { fontSize: 18, fontWeight: 700 },
});
