import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Bar = {
  key: string;
  /** Short axis label ("M", "10/4"); empty to skip. */
  label: string;
  /** Full label for the readout and screen readers ("Tue, Oct 7"). */
  longLabel: string;
  value: number;
  /** Today, still in progress: drawn faded and called out in its label. */
  partial?: boolean;
};

type BarChartProps = {
  bars: Bar[];
  format: (value: number) => string;
  /** Drawn as a dashed reference line when present. */
  average: number | null;
  /** What the chart shows, for screen readers ("Sleep per day"). */
  title: string;
};

const HEIGHT = 120;

/** Rounds up to a tidy axis maximum: 1, 2, 2.5, 5 × 10ⁿ. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * Single-series daily bar chart. Tap a bar to read its exact value; the readout
 * otherwise shows the average. One series, so the card title names it (no legend).
 */
export function BarChart({ bars, format, average, title }: BarChartProps) {
  const theme = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const max = niceCeil(Math.max(...bars.map((b) => b.value), average ?? 0));
  const picked = selected !== null ? bars[selected] : null;

  const readout = picked
    ? `${picked.longLabel}${picked.partial ? ' (so far)' : ''}: ${format(picked.value)}`
    : average !== null
      ? `Average: ${format(average)} per day`
      : 'Tap a bar to see its value';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityLiveRegion="polite"
          style={styles.readout}>
          {readout}
        </ThemedText>
        {/* Value of the top gridline, outside the plot so tall bars never cover it. */}
        <ThemedText type="small" themeColor="textSecondary" style={styles.axis}>
          {format(max)}
        </ThemedText>
      </View>

      <View style={styles.plot} accessibilityLabel={title}>
        {/* Recessive guides: the axis maximum and the baseline. */}
        <View style={[styles.gridline, { top: 0, borderColor: theme.backgroundSelected }]} />
        <View style={[styles.gridline, { bottom: 0, borderColor: theme.backgroundSelected }]} />

        <View style={styles.bars}>
          {bars.map((bar, index) => {
            const isSelected = selected === index;
            return (
              <Pressable
                key={bar.key}
                accessibilityRole="button"
                accessibilityLabel={`${bar.longLabel}${bar.partial ? ', so far' : ''}: ${format(bar.value)}`}
                onPress={() => setSelected(isSelected ? null : index)}
                style={styles.column}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(bar.value > 0 ? 2 : 0, (bar.value / max) * HEIGHT),
                      backgroundColor: theme.chart,
                      opacity: bar.partial ? 0.4 : selected === null || isSelected ? 1 : 0.55,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {average !== null && average > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.average,
              { bottom: (average / max) * HEIGHT, borderColor: theme.textSecondary },
            ]}
          />
        )}
      </View>

      <View style={styles.labels}>
        {bars.map((bar) => (
          <ThemedText
            key={bar.key}
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.label}>
            {bar.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  plot: { height: HEIGHT },
  gridline: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  readout: { flex: 1 },
  axis: { fontSize: 11, lineHeight: 14 },
  bars: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    // 2px surface gap between neighboring bars.
    gap: 2,
  },
  // Each column is a full-height tap target, much bigger than the bar itself.
  column: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  average: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  labels: { flexDirection: 'row', gap: 2 },
  label: { flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 14 },
});
