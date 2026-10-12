import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PUMP_STEP, type VolumeUnit } from '@/lib/units';

export type PumpValues = {
  startAt: number;
  minutes: number;
  /** Amounts are in the display unit (`unit` prop), not ml. */
  leftAmount: number;
  rightAmount: number;
  notes: string;
};

export function PumpForm({
  initial,
  unit,
  submitLabel = 'Save',
  onSubmit,
}: FormProps<PumpValues> & { unit: VolumeUnit }) {
  const step = PUMP_STEP[unit];
  const [startAt, setStartAt] = useState(initial.startAt);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [leftAmount, setLeftAmount] = useState(initial.leftAmount);
  const [rightAmount, setRightAmount] = useState(initial.rightAmount);
  const [notes, setNotes] = useState(initial.notes);

  const total = Math.round((leftAmount + rightAmount) * 100) / 100;

  return (
    <>
      <DateTimeField label="Started" value={startAt} onChange={setStartAt} />

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          HOW LONG
        </ThemedText>
        <Stepper
          value={minutes}
          onChange={setMinutes}
          step={1}
          suffix="min"
          integer
          accessibilityName="minutes"
          size="medium"
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          LEFT
        </ThemedText>
        <Stepper
          value={leftAmount}
          onChange={setLeftAmount}
          step={step}
          suffix={unit}
          accessibilityName="left side amount"
          size="medium"
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          RIGHT
        </ThemedText>
        <Stepper
          value={rightAmount}
          onChange={setRightAmount}
          step={step}
          suffix={unit}
          accessibilityName="right side amount"
          size="medium"
        />
      </View>

      <ThemedText themeColor="textSecondary">
        Total {total} {unit}
      </ThemedText>

      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
      />
      <SubmitButton
        title={submitLabel}
        onPress={() => onSubmit({ startAt, minutes, leftAmount, rightAmount, notes })}
        disabled={minutes <= 0 && total <= 0}
      />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
});
