import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { Button } from '@/components/button';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

export default function SolidsScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [foods, setFoods] = useState('');
  const [time, setTime] = useState(Date.now);
  const [notes, setNotes] = useState('');

  const foodList = foods
    .split(',')
    .map((food) => food.trim())
    .filter(Boolean);

  const save = async () => {
    if (!child) return;
    await insertEvent(db, {
      childId: child.id,
      type: 'feed_solids',
      startAt: time,
      data: { foods: foodList },
      notes: notes.trim() || null,
    });
    successFeedback();
    router.back();
  };

  return (
    <Screen withTabBar={false} belowHeader>
      <TextField
        label="Foods"
        value={foods}
        onChangeText={setFoods}
        placeholder="e.g. banana, oatmeal"
        autoFocus
        autoCapitalize="none"
      />
      <DateTimeField label="Time" value={time} onChange={setTime} />
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Reactions, how much was eaten…"
        multiline
      />
      <Button title="Save" onPress={save} disabled={foodList.length === 0} />
    </Screen>
  );
}
