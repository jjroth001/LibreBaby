import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BabyEvent } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { describeEvent, eventEmoji } from '@/lib/describe';
import { formatTime } from '@/lib/format';
import type { VolumeUnit } from '@/lib/units';

type EventRowProps = {
  event: BabyEvent;
  unit: VolumeUnit;
  /** Local midnight of the day being shown, to flag events that began the day before. */
  dayStart: number;
  running: boolean;
  onPress: () => void;
};

export function EventRow({ event, unit, dayStart, running, onPress }: EventRowProps) {
  const theme = useTheme();
  const ranged = event.type === 'sleep' || event.type === 'feed_breast';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={running ? 'Running timer, manage it on Home' : 'Edit this entry'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <View style={styles.times}>
        {event.startAt < dayStart && (
          <ThemedText type="small" themeColor="textSecondary">
            prev. day
          </ThemedText>
        )}
        <ThemedText type="smallBold">{formatTime(event.startAt)}</ThemedText>
        {ranged && (
          <ThemedText type="small" themeColor="textSecondary">
            {event.endAt ? `– ${formatTime(event.endAt)}` : '– now'}
          </ThemedText>
        )}
      </View>

      <ThemedText style={styles.emoji}>{eventEmoji(event)}</ThemedText>

      <View style={styles.body}>
        <ThemedText>{describeEvent(event, unit)}</ThemedText>
        {running && (
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            In progress
          </ThemedText>
        )}
        {event.notes ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {event.notes}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  times: { width: 76 },
  emoji: { fontSize: 24, lineHeight: 30 },
  body: { flex: 1, gap: Spacing.half },
});
