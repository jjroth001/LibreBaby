import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addLocalDays, startOfLocalDay } from '@/lib/dates';
import { tapFeedback } from '@/lib/haptics';

type DayPickerProps = {
  /** Local midnight of the day shown. */
  day: number;
  /** Local midnight of today; you can't go past it. */
  today: number;
  onChange: (day: number) => void;
};

function dayLabel(day: number, today: number): string {
  if (day === today) return 'Today';
  if (day === addLocalDays(today, -1)) return 'Yesterday';
  return new Date(day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** ‹ Today › — step a day at a time, or tap the date to jump. */
export function DayPicker({ day, today, onChange }: DayPickerProps) {
  const theme = useTheme();
  const atToday = day >= today;

  const step = (days: number) => {
    tapFeedback();
    onChange(addLocalDays(day, days));
  };

  const pick = () =>
    DateTimePickerAndroid.open({
      mode: 'date',
      value: new Date(day),
      maximumDate: new Date(today),
      onValueChange: (_event, date) => onChange(startOfLocalDay(date.getTime())),
    });

  const arrow = [styles.arrow, { backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        onPress={() => step(-1)}
        style={arrow}>
        <ThemedText style={styles.arrowLabel}>‹</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Pick a date"
        onPress={pick}
        style={styles.label}>
        <ThemedText type="subtitle" style={styles.labelText}>
          {dayLabel(day, today)}
        </ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: atToday }}
        disabled={atToday}
        onPress={() => step(1)}
        style={[arrow, atToday && styles.disabled]}>
        <ThemedText style={styles.arrowLabel}>›</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  arrow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLabel: { fontSize: 32, lineHeight: 36, fontWeight: 600 },
  label: { flex: 1, alignItems: 'center' },
  labelText: { fontSize: 26, lineHeight: 34 },
  disabled: { opacity: 0.3 },
});
