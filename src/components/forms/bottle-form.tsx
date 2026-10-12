import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { EventDataMap } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { VOLUME_PRESETS, type VolumeUnit } from '@/lib/units';

const CONTENT_OPTIONS = [
  { value: 'breast_milk', label: 'Breast milk' },
  { value: 'formula', label: 'Formula' },
] as const;

export type BottleValues = {
  /** In the display unit (`unit` prop), not ml. */
  amount: number;
  content: EventDataMap['feed_bottle']['content'];
  time: number;
  notes: string;
};

export function BottleForm({
  initial,
  unit,
  submitLabel = 'Save',
  onSubmit,
}: FormProps<BottleValues> & { unit: VolumeUnit }) {
  const theme = useTheme();
  const preset = VOLUME_PRESETS[unit];
  const [amount, setAmount] = useState(initial.amount);
  const [content, setContent] = useState(initial.content);
  const [time, setTime] = useState(initial.time);
  const [notes, setNotes] = useState(initial.notes);

  return (
    <>
      <Stepper
        value={amount}
        onChange={setAmount}
        step={preset.step}
        suffix={unit}
        accessibilityName="amount"
      />

      <View style={styles.quickRow}>
        {preset.quick.map((value) => {
          const selected = value === amount;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setAmount(value)}
              style={[
                styles.quick,
                { backgroundColor: selected ? theme.tint : theme.backgroundElement },
              ]}>
              <ThemedText style={{ color: selected ? theme.onTint : theme.text }}>
                {value}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SegmentedControl options={CONTENT_OPTIONS} value={content} onChange={setContent} />
      <DateTimeField label="Time" value={time} onChange={setTime} />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
      />
      <SubmitButton
        title={submitLabel}
        onPress={() => onSubmit({ amount, content, time, notes })}
        disabled={amount <= 0}
      />
    </>
  );
}

const styles = StyleSheet.create({
  quickRow: { flexDirection: 'row', gap: Spacing.two },
  quick: {
    flex: 1,
    minHeight: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
