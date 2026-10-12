import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { Button } from '@/components/button';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { formatDuration } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';

const HOUR = 60 * 60 * 1000;

/** Log a sleep after the fact (for when nobody started the timer). */
export default function PastSleepScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [startAt, setStartAt] = useState(() => Date.now() - HOUR);
  const [endAt, setEndAt] = useState(Date.now);
  const [notes, setNotes] = useState('');

  const valid = endAt > startAt;

  const save = async () => {
    if (!child) return;
    await insertEvent(db, {
      childId: child.id,
      type: 'sleep',
      startAt,
      endAt,
      data: {},
      notes: notes.trim() || null,
    });
    successFeedback();
    router.back();
  };

  return (
    <Screen withTabBar={false} belowHeader>
      <DateTimeField label="Fell asleep" value={startAt} onChange={setStartAt} />
      <DateTimeField label="Woke up" value={endAt} onChange={setEndAt} />
      <ThemedText themeColor={valid ? 'textSecondary' : 'danger'}>
        {valid ? `Slept ${formatDuration(endAt - startAt)}` : 'Wake-up time must be after falling asleep.'}
      </ThemedText>
      <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      <Button title="Save" onPress={save} disabled={!valid} />
    </Screen>
  );
}
