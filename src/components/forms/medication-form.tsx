import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { RecentMedication } from '@/db/events';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatDayTime, formatDuration } from '@/lib/format';

export type MedicationValues = { name: string; dose: string; time: number; notes: string };

type MedicationFormProps = FormProps<MedicationValues> & {
  /** Recently given medications, offered as one-tap fill-ins. */
  recent: RecentMedication[];
  /** Show when the typed medication was last given (off when editing that very entry). */
  showLastGiven?: boolean;
};

export function MedicationForm({
  initial,
  recent,
  showLastGiven = true,
  submitLabel = 'Save',
  onSubmit,
}: MedicationFormProps) {
  const theme = useTheme();
  const now = useNow(60_000);
  const [name, setName] = useState(initial.name);
  const [dose, setDose] = useState(initial.dose);
  const [time, setTime] = useState(initial.time);
  const [notes, setNotes] = useState(initial.notes);

  const trimmedName = name.trim();
  const lastGiven = recent
    .filter((med) => med.name.toLowerCase() === trimmedName.toLowerCase())
    .reduce<number | null>((latest, med) => Math.max(latest ?? 0, med.lastGivenAt), null);

  return (
    <>
      {recent.length > 0 && (
        <View style={styles.chips}>
          {recent.map((med) => (
            <Pressable
              key={`${med.name}|${med.dose}`}
              accessibilityRole="button"
              onPress={() => {
                setName(med.name);
                setDose(med.dose);
              }}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
              ]}>
              <ThemedText type="small">
                {med.dose ? `${med.name} · ${med.dose}` : med.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <TextField
        label="Medication"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Vitamin D"
        autoCapitalize="words"
        autoFocus={initial.name === '' && recent.length === 0}
      />
      <TextField
        label="Dose"
        value={dose}
        onChangeText={setDose}
        placeholder="e.g. 2.5 ml (optional)"
      />

      {showLastGiven && lastGiven !== null && (
        <ThemedText themeColor="textSecondary">
          Last given {formatDuration(now - lastGiven)} ago ({formatDayTime(lastGiven, now)})
        </ThemedText>
      )}

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
        onPress={() => onSubmit({ name: trimmedName, dose: dose.trim(), time, notes })}
        disabled={trimmedName.length === 0}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    justifyContent: 'center',
  },
});
