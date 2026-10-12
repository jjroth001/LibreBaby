import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/format';

type DateTimeFieldProps = {
  label?: string;
  /** Unix ms. */
  value: number;
  onChange: (value: number) => void;
  /** Values past this are clamped. Defaults to "now" — events can't be in the future. */
  max?: number;
};

function formatDay(ms: number): string {
  const day = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** A date chip and a time chip, each opening the matching Android picker. */
export function DateTimeField({ label, value, onChange, max }: DateTimeFieldProps) {
  const theme = useTheme();

  const commit = (next: Date) => onChange(Math.min(next.getTime(), max ?? Date.now()));

  const pickDate = () =>
    DateTimePickerAndroid.open({
      mode: 'date',
      value: new Date(value),
      maximumDate: new Date(max ?? Date.now()),
      onValueChange: (_event, picked) => {
        const next = new Date(value);
        next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        commit(next);
      },
    });

  const pickTime = () =>
    DateTimePickerAndroid.open({
      mode: 'time',
      value: new Date(value),
      onValueChange: (_event, picked) => {
        const next = new Date(value);
        next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        commit(next);
      },
    });

  const chip = [styles.chip, { backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.group}>
      {label && (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label.toUpperCase()}
        </ThemedText>
      )}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={pickDate} style={[chip, styles.dateChip]}>
          <ThemedText style={styles.text}>{formatDay(value)}</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={pickTime} style={chip}>
          <ThemedText style={styles.text}>{formatTime(value)}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  dateChip: { flex: 1 },
  text: { fontSize: 18 },
});
