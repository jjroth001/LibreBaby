import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BreastSide } from '@/db/types';
import { formatDuration } from '@/lib/format';

const MINUTE = 60_000;

const SIDE_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
] as const;

export type BreastValues = {
  startAt: number;
  leftMin: number;
  rightMin: number;
  /** Only meaningful when both sides were used. */
  endedOn: BreastSide;
  notes: string;
};

export function BreastForm({ initial, submitLabel = 'Save', onSubmit }: FormProps<BreastValues>) {
  const [startAt, setStartAt] = useState(initial.startAt);
  const [leftMin, setLeftMin] = useState(initial.leftMin);
  const [rightMin, setRightMin] = useState(initial.rightMin);
  const [endedOn, setEndedOn] = useState(initial.endedOn);
  const [notes, setNotes] = useState(initial.notes);

  const totalMin = leftMin + rightMin;

  return (
    <>
      <DateTimeField label="Started" value={startAt} onChange={setStartAt} />

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          LEFT
        </ThemedText>
        <Stepper
          value={leftMin}
          onChange={setLeftMin}
          step={1}
          suffix="min"
          integer
          accessibilityName="left side minutes"
          size="medium"
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          RIGHT
        </ThemedText>
        <Stepper
          value={rightMin}
          onChange={setRightMin}
          step={1}
          suffix="min"
          integer
          accessibilityName="right side minutes"
          size="medium"
        />
      </View>

      {leftMin > 0 && rightMin > 0 && (
        <View style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ENDED ON
          </ThemedText>
          <SegmentedControl options={SIDE_OPTIONS} value={endedOn} onChange={setEndedOn} />
        </View>
      )}

      <ThemedText themeColor={totalMin > 0 ? 'textSecondary' : 'danger'}>
        {totalMin > 0
          ? `Total ${formatDuration(totalMin * MINUTE)}`
          : 'Add time to at least one side.'}
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
        onPress={() => onSubmit({ startAt, leftMin, rightMin, endedOn, notes })}
        disabled={totalMin <= 0}
      />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
});
