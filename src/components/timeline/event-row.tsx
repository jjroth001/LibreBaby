import { Pressable, StyleSheet, View } from 'react-native';

import { eventIcon } from '@/components/icons/event-icon';
import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BabyEvent } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { describeEvent } from '@/lib/describe';
import { formatTime } from '@/lib/format';
import type { GrowthUnits } from '@/lib/growth-units';
import type { VolumeUnit } from '@/lib/units';

type EventRowProps = {
  event: BabyEvent;
  unit: VolumeUnit;
  growthUnits: GrowthUnits;
  /** Local midnight of the day being shown, to flag events that began the day before. */
  dayStart: number;
  running: boolean;
  onPress: () => void;
};

export function EventRow({ event, unit, growthUnits, dayStart, running, onPress }: EventRowProps) {
  const theme = useTheme();
  const ranged = event.type === 'sleep' || event.type === 'feed_breast' || event.type === 'pump';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={running ? 'Running timer, manage it on Home' : 'Edit this entry'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
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

      <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
        <Icon name={eventIcon(event)} size={22} color={theme.text} />
      </View>

      <View style={styles.body}>
        <ThemedText>{describeEvent(event, unit, growthUnits)}</ThemedText>
        {running && (
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
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
    borderRadius: 20,
  },
  times: { width: 72 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: Spacing.half },
});
