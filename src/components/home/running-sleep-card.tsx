import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateTimeField } from '@/components/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteEvent, updateEvent } from '@/db/events';
import type { BabyEvent } from '@/db/types';
import { formatClock } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';

export function RunningSleepCard({ event, now }: { event: BabyEvent<'sleep'>; now: number }) {
  const db = useSQLiteContext();

  const wakeUp = async () => {
    await updateEvent<'sleep'>(db, event.id, { endAt: Date.now() });
    successFeedback();
  };

  const discard = () =>
    Alert.alert('Discard this sleep?', 'The running sleep timer will be removed.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => deleteEvent(db, event.id) },
    ]);

  return (
    <Card>
      <ThemedText type="smallBold">😴 Sleeping</ThemedText>
      <ThemedText style={styles.clock}>{formatClock(now - event.startAt)}</ThemedText>
      <DateTimeField
        label="Fell asleep"
        value={event.startAt}
        onChange={(startAt) => updateEvent<'sleep'>(db, event.id, { startAt })}
      />
      <View style={styles.actions}>
        <Button title="Discard" variant="secondary" onPress={discard} />
        <Button title="Woke up" onPress={wakeUp} style={styles.primary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  clock: { fontSize: 48, lineHeight: 56, fontWeight: 600, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: Spacing.two },
  primary: { flex: 1 },
});
