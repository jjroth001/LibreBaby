import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { Button } from '@/components/button';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

type Kind = 'wet' | 'dirty' | 'both';

const KIND_OPTIONS = [
  { value: 'wet', label: '💧 Wet' },
  { value: 'dirty', label: '💩 Dirty' },
  { value: 'both', label: 'Both' },
] as const;

/** Log a diaper at a specific time (the Home buttons log "now"). */
export default function DiaperScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [kind, setKind] = useState<Kind>('wet');
  const [time, setTime] = useState(Date.now);
  const [notes, setNotes] = useState('');

  const save = async () => {
    if (!child) return;
    await insertEvent(db, {
      childId: child.id,
      type: 'diaper',
      startAt: time,
      data: { wet: kind !== 'dirty', dirty: kind !== 'wet' },
      notes: notes.trim() || null,
    });
    successFeedback();
    router.back();
  };

  return (
    <Screen withTabBar={false} belowHeader>
      <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} />
      <DateTimeField label="Time" value={time} onChange={setTime} />
      <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      <Button title="Save" onPress={save} />
    </Screen>
  );
}
