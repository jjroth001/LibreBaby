import { useState } from 'react';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { formatDuration } from '@/lib/format';

export type SleepValues = { startAt: number; endAt: number; notes: string };

export function SleepForm({ initial, submitLabel = 'Save', onSubmit }: FormProps<SleepValues>) {
  const [startAt, setStartAt] = useState(initial.startAt);
  const [endAt, setEndAt] = useState(initial.endAt);
  const [notes, setNotes] = useState(initial.notes);

  const valid = endAt > startAt;

  return (
    <>
      <DateTimeField label="Fell asleep" value={startAt} onChange={setStartAt} />
      <DateTimeField label="Woke up" value={endAt} onChange={setEndAt} />
      <ThemedText themeColor={valid ? 'textSecondary' : 'danger'}>
        {valid
          ? `Slept ${formatDuration(endAt - startAt)}`
          : 'Wake-up time must be after falling asleep.'}
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
        onPress={() => onSubmit({ startAt, endAt, notes })}
        disabled={!valid}
      />
    </>
  );
}
