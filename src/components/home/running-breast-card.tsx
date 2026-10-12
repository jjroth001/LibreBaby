import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CardTitle } from '@/components/card-title';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteEvent, modifyEvent } from '@/db/events';
import type { BabyEvent, BreastSide } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { finishBreast, sideTotals, tapSide } from '@/lib/breast';
import { formatClock } from '@/lib/format';
import { successFeedback, tapFeedback } from '@/lib/haptics';

const SIDE_LABEL: Record<BreastSide, string> = { L: 'Left', R: 'Right' };

export function RunningBreastCard({
  event,
  now,
}: {
  event: BabyEvent<'feed_breast'>;
  now: number;
}) {
  const db = useSQLiteContext();
  const { data } = event;
  const totals = sideTotals(data, now);

  const onSide = async (side: BreastSide) => {
    tapFeedback();
    const tappedAt = Date.now();
    await modifyEvent<'feed_breast'>(db, event.id, (current) => ({
      data: tapSide(current.data, side, tappedAt),
    }));
  };

  const finish = async () => {
    const end = Date.now();
    await modifyEvent<'feed_breast'>(db, event.id, (current) => ({
      endAt: end,
      data: finishBreast(current.data, end),
    }));
    successFeedback();
  };

  const discard = () =>
    Alert.alert('Discard this feed?', 'The running feed timer will be removed.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => deleteEvent(db, event.id),
      },
    ]);

  return (
    <Card>
      <CardTitle icon="breast">
        {`Breastfeeding · ${data.activeSide ? `on ${SIDE_LABEL[data.activeSide].toLowerCase()}` : 'paused'}`}
      </CardTitle>
      <ThemedText style={styles.clock}>{formatClock(totals.leftMs + totals.rightMs)}</ThemedText>

      <View style={styles.sides}>
        <SideButton side="L" ms={totals.leftMs} active={data.activeSide === 'L'} onPress={onSide} />
        <SideButton
          side="R"
          ms={totals.rightMs}
          active={data.activeSide === 'R'}
          onPress={onSide}
        />
      </View>

      <View style={styles.actions}>
        <Button title="Discard" variant="secondary" onPress={discard} />
        <Button title="Done" onPress={finish} style={styles.primary} />
      </View>
    </Card>
  );
}

type SideButtonProps = {
  side: BreastSide;
  ms: number;
  active: boolean;
  onPress: (side: BreastSide) => void;
};

function SideButton({ side, ms, active, onPress }: SideButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${SIDE_LABEL[side]} side, ${active ? 'running, tap to pause' : 'tap to start'}`}
      onPress={() => onPress(side)}
      style={({ pressed }) => [
        styles.side,
        { backgroundColor: active ? theme.tint : theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" style={{ color: active ? theme.onTint : theme.textSecondary }}>
        {SIDE_LABEL[side].toUpperCase()}
        {active ? ' · PAUSE' : ''}
      </ThemedText>
      <ThemedText style={[styles.sideClock, { color: active ? theme.onTint : theme.text }]}>
        {formatClock(ms)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clock: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: 300,
    fontVariant: ['tabular-nums'],
  },
  sides: { flexDirection: 'row', gap: Spacing.two },
  side: {
    flex: 1,
    minHeight: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  sideClock: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  pressed: { opacity: 0.8 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  primary: { flex: 1 },
});
