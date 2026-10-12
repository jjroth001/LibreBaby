import { useState } from 'react';

import { DateTimeField } from '@/components/date-time-field';
import { SubmitButton } from '@/components/forms/submit-button';
import type { FormProps } from '@/components/forms/types';
import { TextField } from '@/components/text-field';

export type SolidsValues = { foods: string[]; time: number; notes: string };

function parseFoods(text: string): string[] {
  return text
    .split(',')
    .map((food) => food.trim())
    .filter(Boolean);
}

export function SolidsForm({ initial, submitLabel = 'Save', onSubmit }: FormProps<SolidsValues>) {
  const [foodsText, setFoodsText] = useState(initial.foods.join(', '));
  const [time, setTime] = useState(initial.time);
  const [notes, setNotes] = useState(initial.notes);

  const foods = parseFoods(foodsText);

  return (
    <>
      <TextField
        label="Foods"
        value={foodsText}
        onChangeText={setFoodsText}
        placeholder="e.g. banana, oatmeal"
        autoFocus={initial.foods.length === 0}
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
      <SubmitButton
        title={submitLabel}
        onPress={() => onSubmit({ foods, time, notes })}
        disabled={foods.length === 0}
      />
    </>
  );
}
