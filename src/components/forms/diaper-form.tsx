import { useState } from 'react';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import type { EventDataMap } from '@/db/types';

type DiaperData = EventDataMap['diaper'];
type Kind = 'wet' | 'dirty' | 'both';

const KIND_OPTIONS = [
  { value: 'wet', label: '💧 Wet' },
  { value: 'dirty', label: '💩 Dirty' },
  { value: 'both', label: 'Both' },
] as const;

function toKind({ wet, dirty }: DiaperData): Kind {
  return wet && dirty ? 'both' : dirty ? 'dirty' : 'wet';
}

function fromKind(kind: Kind): DiaperData {
  return { wet: kind !== 'dirty', dirty: kind !== 'wet' };
}

export type DiaperValues = { data: DiaperData; time: number; notes: string };

export function DiaperForm({ initial, submitLabel = 'Save', onSubmit }: FormProps<DiaperValues>) {
  const [kind, setKind] = useState(toKind(initial.data));
  const [time, setTime] = useState(initial.time);
  const [notes, setNotes] = useState(initial.notes);

  return (
    <>
      <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} />
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
        onPress={() => onSubmit({ data: fromKind(kind), time, notes })}
      />
    </>
  );
}
