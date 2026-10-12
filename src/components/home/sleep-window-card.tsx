import { StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { SleepState } from '@/hooks/use-sleep-prediction';
import { formatDuration, formatTime } from '@/lib/format';

type SleepWindowCardProps = { state: SleepState; now: number; childName: string };

/** When the next sleep is likely due, and what that estimate is based on. */
export function SleepWindowCard({ state, now, childName }: SleepWindowCardProps) {
  if (state.status === 'loading' || state.status === 'sleeping') return null;

  if (state.status === 'no-data') {
    return (
      <Card>
        <ThemedText type="smallBold">🌙 Next sleep</ThemedText>
        <ThemedText themeColor="textSecondary">
          Log a sleep and LibreBaby will estimate when the next one is due.
        </ThemedText>
      </Card>
    );
  }

  const { opensAt, closesAt, ageRange, personalMs } = state.prediction;
  const window = `${formatTime(opensAt)} – ${formatTime(closesAt)}`;

  let headline: string;
  let detail: string;
  if (now < opensAt) {
    headline = `Sleep window in ${formatDuration(opensAt - now)}`;
    detail = window;
  } else if (now <= closesAt) {
    headline = 'Sleep window is open';
    detail = `Until ${formatTime(closesAt)}`;
  } else {
    headline = 'Past the sleep window';
    detail = `It was ${window} — ${childName} may be getting overtired.`;
  }

  const basis =
    personalMs !== null
      ? `Based on age and ${childName}'s recent awake times (usually ${formatDuration(personalMs)}).`
      : `Based on typical awake times for this age (${formatDuration(ageRange.minMs)}–${formatDuration(ageRange.maxMs)}). Adapts to ${childName} after a few days of logged naps.`;

  return (
    <Card style={styles.card}>
      <ThemedText type="smallBold">🌙 Next sleep</ThemedText>
      <ThemedText style={styles.headline}>{headline}</ThemedText>
      <ThemedText>{detail}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {basis}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
});
