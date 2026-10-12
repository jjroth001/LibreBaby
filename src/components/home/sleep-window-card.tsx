import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Card } from '@/components/card';
import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { SleepState } from '@/hooks/use-sleep-prediction';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatTime } from '@/lib/format';

type SleepWindowCardProps = {
  state: SleepState;
  now: number;
  childName: string;
};

const GAUGE_W = 220;
const STROKE = 6;
const R = (GAUGE_W - STROKE) / 2;
const GAUGE_H = R + STROKE;

/** Point on the gauge's half circle, for a fraction 0 (left end) … 1 (right end). */
function arcPoint(fraction: number) {
  const angle = Math.PI * (1 - fraction);
  return [GAUGE_W / 2 + R * Math.cos(angle), R + STROKE / 2 - R * Math.sin(angle)];
}

function arc(from: number, to: number) {
  const [x1, y1] = arcPoint(from);
  const [x2, y2] = arcPoint(to);
  return `M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`;
}

/**
 * When the next sleep is likely due. The gauge runs from waking up to the end of the sleep
 * window: the window is the brighter stretch at the end, the filled part is time awake.
 */
export function SleepWindowCard({ state, now, childName }: SleepWindowCardProps) {
  const theme = useTheme();
  if (state.status === 'loading' || state.status === 'sleeping') return null;

  if (state.status === 'no-data') {
    return (
      <Card style={styles.center}>
        <Icon name="moon-stars" size={24} color={theme.accent} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
          NEXT SLEEP
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Log a sleep and LibreBaby will estimate when the next one is due.
        </ThemedText>
      </Card>
    );
  }

  const { opensAt, closesAt, ageRange, personalMs } = state.prediction;
  const wokeAt = state.lastWokeAt;
  const span = Math.max(1, closesAt - wokeAt);
  const progress = Math.min(1, Math.max(0, (now - wokeAt) / span));
  const windowStart = Math.min(1, Math.max(0, (opensAt - wokeAt) / span));
  const window = `${formatTime(opensAt)} – ${formatTime(closesAt)}`;

  let headline: string;
  let detail: string;
  if (now < opensAt) {
    headline = `in ${formatDuration(opensAt - now)}`;
    detail = `Window ${window}`;
  } else if (now <= closesAt) {
    headline = 'Window open';
    detail = `Until ${formatTime(closesAt)}`;
  } else {
    headline = 'Past window';
    detail = `It was ${window} — ${childName} may be getting overtired.`;
  }

  const basis =
    personalMs !== null
      ? `Based on age and ${childName}'s recent awake times (usually ${formatDuration(personalMs)}).`
      : `Based on typical awake times for this age (${formatDuration(ageRange.minMs)}–${formatDuration(ageRange.maxMs)}). Adapts to ${childName} after a few days of logged naps.`;

  return (
    <Card style={styles.center}>
      <View
        style={styles.gauge}
        accessible
        accessibilityLabel={`Next sleep ${headline}. ${detail}`}>
        <Svg width={GAUGE_W} height={GAUGE_H} style={StyleSheet.absoluteFill}>
          <Path
            d={arc(0, 1)}
            stroke={theme.text}
            strokeOpacity={0.16}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d={arc(windowStart, 1)}
            stroke={theme.accent}
            strokeOpacity={0.55}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
          {progress > 0.005 && (
            <Path
              d={arc(0, progress)}
              stroke={theme.text}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>
        <Icon name="moon-stars" size={22} color={theme.accent} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
          NEXT SLEEP
        </ThemedText>
        <ThemedText style={styles.headline}>{headline}</ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.centerText}>
        {detail}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {basis}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.one },
  gauge: {
    width: GAUGE_W,
    height: GAUGE_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: Spacing.four,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    marginTop: Spacing.one,
  },
  headline: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: 300,
    fontVariant: ['tabular-nums'],
  },
  centerText: { textAlign: 'center' },
});
