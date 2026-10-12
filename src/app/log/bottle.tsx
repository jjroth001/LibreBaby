import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getLatestEvent, insertEvent } from '@/db/events';
import type { BabyEvent, EventDataMap } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { fromMl, toMl, VOLUME_PRESETS, type VolumeUnit } from '@/lib/units';

type Content = EventDataMap['feed_bottle']['content'];

const CONTENT_OPTIONS = [
  { value: 'breast_milk', label: 'Breast milk' },
  { value: 'formula', label: 'Formula' },
] as const;

export default function BottleScreen() {
  const child = useChild();
  const settings = useSettings();
  const childId = child.data?.id;
  const last = useDbQuery(
    ['event'],
    async (db) => (childId ? getLatestEvent(db, childId, ['feed_bottle']) : null),
    [childId],
  );

  if (!childId || settings.status !== 'success' || last.status !== 'success') return null;
  return <BottleForm childId={childId} unit={settings.data.volumeUnit} last={last.data} />;
}

type BottleFormProps = { childId: string; unit: VolumeUnit; last: BabyEvent<'feed_bottle'> | null };

function BottleForm({ childId, unit, last }: BottleFormProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const preset = VOLUME_PRESETS[unit];
  // Prefill with the previous bottle — most days it's the same amount.
  const [amount, setAmount] = useState(last ? fromMl(last.data.amountMl, unit) : preset.quick[3]);
  const [content, setContent] = useState<Content>(last?.data.content ?? 'breast_milk');
  const [time, setTime] = useState(Date.now);
  const [notes, setNotes] = useState('');

  const step = (direction: 1 | -1) => {
    tapFeedback();
    setAmount((a) => Math.max(0, Math.round((a + direction * preset.step) * 10) / 10));
  };

  const save = async () => {
    await insertEvent(db, {
      childId,
      type: 'feed_bottle',
      startAt: time,
      data: { amountMl: toMl(amount, unit), content },
      notes: notes.trim() || null,
    });
    successFeedback();
    router.back();
  };

  const stepButton = [styles.stepButton, { backgroundColor: theme.backgroundElement }];

  return (
    <Screen withTabBar={false} belowHeader>
      <View style={styles.amountRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Less" onPress={() => step(-1)} style={stepButton}>
          <ThemedText style={styles.stepLabel}>−</ThemedText>
        </Pressable>
        <ThemedText style={styles.amount}>
          {amount} {unit}
        </ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => step(1)} style={stepButton}>
          <ThemedText style={styles.stepLabel}>+</ThemedText>
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        {preset.quick.map((value) => {
          const selected = value === amount;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setAmount(value)}
              style={[
                styles.quick,
                { backgroundColor: selected ? theme.tint : theme.backgroundElement },
              ]}>
              <ThemedText style={{ color: selected ? theme.onTint : theme.text }}>{value}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <SegmentedControl options={CONTENT_OPTIONS} value={content} onChange={setContent} />
      <DateTimeField label="Time" value={time} onChange={setTime} />
      <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      <Button title="Save" onPress={save} disabled={amount <= 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { fontSize: 44, lineHeight: 52, fontWeight: 700, fontVariant: ['tabular-nums'] },
  stepButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { fontSize: 32, lineHeight: 36, fontWeight: 600 },
  quickRow: { flexDirection: 'row', gap: Spacing.two },
  quick: {
    flex: 1,
    minHeight: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
