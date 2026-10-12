import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { parseGrowth, type GrowthValues } from '@/components/forms/growth-mapping';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { BabyEvent, EventDataMap } from '@/db/types';
import type { GrowthUnits } from '@/lib/growth-units';

type GrowthFormProps = Omit<FormProps<GrowthValues>, 'onSubmit'> & {
  units: GrowthUnits;
  /** When editing: unchanged fields keep their exact stored values. */
  original?: BabyEvent<'growth'>;
  onSubmit: (result: {
    startAt: number;
    data: EventDataMap['growth'];
    notes: string;
  }) => Promise<void>;
};

export function GrowthForm({
  initial,
  units,
  original,
  submitLabel = 'Save',
  onSubmit,
}: GrowthFormProps) {
  const [values, setValues] = useState(initial);
  const set = (key: keyof GrowthValues) => (text: string) =>
    setValues((v) => ({ ...v, [key]: text }));

  const parsed = parseGrowth(values, units, original);
  const imperial = units === 'imperial';
  const lengthUnit = imperial ? 'in' : 'cm';
  const numeric = { keyboardType: 'decimal-pad' as const, placeholder: '—' };

  return (
    <>
      <DateTimeField
        label="Measured"
        value={values.time}
        onChange={(time) => setValues((v) => ({ ...v, time }))}
      />

      <ThemedText type="small" themeColor="textSecondary">
        Fill in whatever was measured — leave the rest blank.
      </ThemedText>

      {imperial ? (
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label="Weight (lb)"
              value={values.weightA}
              onChangeText={set('weightA')}
              {...numeric}
            />
          </View>
          <View style={styles.half}>
            <TextField
              label="(oz)"
              value={values.weightB}
              onChangeText={set('weightB')}
              {...numeric}
            />
          </View>
        </View>
      ) : (
        <TextField
          label="Weight (kg)"
          value={values.weightA}
          onChangeText={set('weightA')}
          {...numeric}
        />
      )}

      <TextField
        label={`Length (${lengthUnit})`}
        value={values.length}
        onChangeText={set('length')}
        {...numeric}
      />
      <TextField
        label={`Head circumference (${lengthUnit})`}
        value={values.head}
        onChangeText={set('head')}
        {...numeric}
      />

      {'error' in parsed && parsed.error && (
        <ThemedText themeColor="danger">{parsed.error}</ThemedText>
      )}

      <TextField
        label="Notes"
        value={values.notes}
        onChangeText={set('notes')}
        placeholder="e.g. 4-month checkup"
        multiline
      />
      <SubmitButton
        title={submitLabel}
        disabled={!('data' in parsed)}
        onPress={async () => {
          if ('data' in parsed) {
            await onSubmit({ startAt: values.time, data: parsed.data, notes: values.notes });
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  half: { flex: 1 },
});
