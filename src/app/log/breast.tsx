import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { insertEvent } from '@/db/events';
import type { BreastSide } from '@/db/types';
import { useChild } from '@/db/use-child';
import { manualBreast } from '@/lib/breast';
import { formatDuration } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';

const MINUTE = 60_000;

const SIDE_OPTIONS = [
  { value: 'L', label: 'Left' },
  { value: 'R', label: 'Right' },
] as const;

/** Log a breastfeed after the fact, with minutes per side. */
export default function PastBreastfeedScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [startAt, setStartAt] = useState(() => Date.now() - 30 * MINUTE);
  const [leftMin, setLeftMin] = useState(10);
  const [rightMin, setRightMin] = useState(10);
  const [endedOn, setEndedOn] = useState<BreastSide>('R');
  const [notes, setNotes] = useState('');

  const usedBoth = leftMin > 0 && rightMin > 0;
  const totalMin = leftMin + rightMin;

  const save = async () => {
    if (!child) return;
    const data = manualBreast(leftMin * MINUTE, rightMin * MINUTE, endedOn);
    await insertEvent(db, {
      childId: child.id,
      type: 'feed_breast',
      startAt,
      endAt: startAt + totalMin * MINUTE,
      data,
      notes: notes.trim() || null,
    });
    successFeedback();
    router.back();
  };

  return (
    <Screen withTabBar={false} belowHeader>
      <DateTimeField label="Started" value={startAt} onChange={setStartAt} />

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          LEFT
        </ThemedText>
        <Stepper
          value={leftMin}
          onChange={setLeftMin}
          step={1}
          display={`${leftMin} min`}
          accessibilityName="left side minutes"
          size="medium"
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          RIGHT
        </ThemedText>
        <Stepper
          value={rightMin}
          onChange={setRightMin}
          step={1}
          display={`${rightMin} min`}
          accessibilityName="right side minutes"
          size="medium"
        />
      </View>

      {usedBoth && (
        <View style={styles.group}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ENDED ON
          </ThemedText>
          <SegmentedControl options={SIDE_OPTIONS} value={endedOn} onChange={setEndedOn} />
        </View>
      )}

      <ThemedText themeColor={totalMin > 0 ? 'textSecondary' : 'danger'}>
        {totalMin > 0 ? `Total ${formatDuration(totalMin * MINUTE)}` : 'Add time to at least one side.'}
      </ThemedText>

      <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline />
      <Button title="Save" onPress={save} disabled={totalMin <= 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
});
