import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_CHART_MONTHS, referenceCurves, type Measure, type Sex } from '@/lib/growth';
import { toDisplayNumber, type GrowthUnits } from '@/lib/growth-units';

export type GrowthPoint = {
  id: string;
  ageMonths: number;
  /** Metric value (kg or cm). */
  value: number;
  /** Readout shown when the point is tapped. */
  description: string;
};

type GrowthChartProps = {
  measure: Measure;
  sex: Sex;
  units: GrowthUnits;
  points: GrowthPoint[];
  /** Child's current age, so the x-axis reaches today even before the next measurement. */
  ageNowMonths: number;
  childName: string;
};

const HEIGHT = 230;
const PAD = { top: 8, right: 8, bottom: 24, left: 34 };

function niceStep(span: number, targetTicks = 4): number {
  const raw = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (raw <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * The child's measurements over WHO reference bands (3rd–97th and 15th–85th percentiles)
 * and the median. Tap a dot to read it; the measurement list below doubles as the table view.
 */
export function GrowthChart({
  measure,
  sex,
  units,
  points,
  ageNowMonths,
  childName,
}: GrowthChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kind = measure === 'weight' ? 'weight' : 'length';
  const show = (metric: number) => toDisplayNumber(metric, kind, units);
  const axisUnit =
    measure === 'weight'
      ? units === 'imperial'
        ? 'lb'
        : 'kg'
      : units === 'imperial'
        ? 'in'
        : 'cm';

  // Show from birth to a little past the latest point (at least 6 months, at most 24).
  const latestAge = Math.max(ageNowMonths, ...points.map((p) => p.ageMonths));
  const xMax = Math.min(MAX_CHART_MONTHS, Math.max(6, Math.ceil(latestAge) + 2));
  const curves = referenceCurves(measure, sex, xMax);

  const values = points.map((p) => show(p.value));
  const lowest = Math.min(show(curves[0].p3), ...values);
  const highest = Math.max(show(curves[curves.length - 1].p97), ...values);
  const yStep = niceStep(highest - lowest);
  const yMin = Math.floor(lowest / yStep) * yStep;
  const yMax = Math.ceil(highest / yStep) * yStep;

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (months: number) => PAD.left + (months / xMax) * plotW;
  const y = (display: number) => PAD.top + (1 - (display - yMin) / (yMax - yMin)) * plotH;

  const line = (pick: (c: (typeof curves)[number]) => number) =>
    curves.map((c, i) => `${i ? 'L' : 'M'}${x(c.ageMonths)},${y(show(pick(c)))}`).join(' ');
  const band = (upper: 'p97' | 'p85', lower: 'p3' | 'p15') =>
    `${line((c) => c[upper])} ${[...curves]
      .reverse()
      .map((c) => `L${x(c.ageMonths)},${y(show(c[lower]))}`)
      .join(' ')} Z`;

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) yTicks.push(Math.round(v * 100) / 100);
  const xStep = xMax <= 6 ? 1 : xMax <= 12 ? 2 : 3;
  const xTicks: number[] = [];
  for (let m = 0; m <= xMax; m += xStep) xTicks.push(m);

  const visible = points.filter((p) => p.ageMonths <= xMax);
  const selected = visible.find((p) => p.id === selectedId) ?? null;
  const latest = visible[visible.length - 1];

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
        {selected
          ? selected.description
          : visible.length
            ? 'Tap a dot to see that measurement.'
            : 'Add a measurement to see where it falls.'}
      </ThemedText>

      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={
          latest
            ? `Growth chart. Latest: ${latest.description}`
            : 'Growth chart with WHO reference ranges'
        }>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {/* Recessive grid and axis labels */}
            {yTicks.map((v) => (
              <G key={`y${v}`}>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={theme.backgroundSelected}
                  strokeWidth={1}
                />
                <SvgText
                  x={PAD.left - 6}
                  y={y(v) + 4}
                  fontSize={11}
                  fill={theme.textSecondary}
                  textAnchor="end">
                  {v}
                </SvgText>
              </G>
            ))}
            {xTicks.map((m) => (
              <SvgText
                key={`x${m}`}
                x={x(m)}
                y={HEIGHT - 6}
                fontSize={11}
                fill={theme.textSecondary}
                textAnchor="middle">
                {m}
              </SvgText>
            ))}

            {/* WHO reference: outer band, inner band, median */}
            <Path d={band('p97', 'p3')} fill={theme.growthBandOuter} />
            <Path d={band('p85', 'p15')} fill={theme.growthBandInner} />
            <Path
              d={line((c) => c.p50)}
              stroke={theme.textSecondary}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="none"
            />

            {/* The child */}
            {visible.length > 1 && (
              <Path
                d={visible
                  .map((p, i) => `${i ? 'L' : 'M'}${x(p.ageMonths)},${y(show(p.value))}`)
                  .join(' ')}
                stroke={theme.growthChild}
                strokeWidth={2}
                fill="none"
              />
            )}
            {visible.map((p) => {
              const cx = x(p.ageMonths);
              const cy = y(show(p.value));
              const isSelected = p.id === selectedId;
              return (
                <G key={p.id}>
                  {/* 2px ring in the card color keeps dots legible over lines and bands. */}
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 7 : 5}
                    fill={theme.growthChild}
                    stroke={theme.surface}
                    strokeWidth={2}
                  />
                  {/* Generous invisible hit target. */}
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={18}
                    fill="transparent"
                    onPress={() => setSelectedId(isSelected ? null : p.id)}
                  />
                </G>
              );
            })}
          </Svg>
        )}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.axisTitle}>
        Age (months) · {axisUnit}
      </ThemedText>

      {/* Legend: identity never relies on color alone. */}
      <View style={styles.legend}>
        <LegendItem
          swatch={<View style={[styles.swatch, { backgroundColor: theme.growthBandOuter }]} />}
          label="3rd–97th percentile"
        />
        <LegendItem
          swatch={<View style={[styles.swatch, { backgroundColor: theme.growthBandInner }]} />}
          label="15th–85th"
        />
        <LegendItem
          swatch={<View style={[styles.dash, { borderColor: theme.textSecondary }]} />}
          label="Median (50th)"
        />
        <LegendItem
          swatch={<View style={[styles.dot, { backgroundColor: theme.growthChild }]} />}
          label={childName}
        />
      </View>
    </View>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <View style={styles.legendItem}>
      {swatch}
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  axisTitle: { textAlign: 'center', fontSize: 11, lineHeight: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three, rowGap: Spacing.one },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 14, height: 10, borderRadius: 2 },
  dash: { width: 16, borderTopWidth: 1.5, borderStyle: 'dashed' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
