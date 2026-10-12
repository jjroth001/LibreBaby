import { useState } from 'react';

import { CardTitle } from '@/components/card-title';
import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { TextField } from '@/components/text-field';

export type MilestoneValues = { text: string; time: number; notes: string };

/** When a milestone was first noticed, and a note about it. The milestone itself is fixed. */
export function MilestoneForm({
  initial,
  submitLabel = 'Save',
  onSubmit,
}: FormProps<MilestoneValues>) {
  const [time, setTime] = useState(initial.time);
  const [notes, setNotes] = useState(initial.notes);

  return (
    <>
      <CardTitle icon="sparkle">{initial.text}</CardTitle>
      <DateTimeField label="First noticed" value={time} onChange={setTime} />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional, like what happened"
        multiline
      />
      <SubmitButton
        title={submitLabel}
        onPress={() => onSubmit({ text: initial.text, time, notes })}
      />
    </>
  );
}
