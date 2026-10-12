import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { GrowthChart, type GrowthPoint } from '@/components/insights/growth-chart';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { updateChild } from '@/db/children';
import { listEventsOfType } from '@/db/events';
import type { BabyEvent, Child, Sex } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { ageInDays, formatAge } from '@/lib/dates';
import {
  DAYS_PER_MONTH,
  MAX_CHART_MONTHS,
  formatPercentile,
  percentileFor,
  type Measure,
} from '@/lib/growth';
import { formatLength, formatWeight, type GrowthUnits } from '@/lib/growth-units';

const MEASURE_OPTIONS = [
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Length' },
  { value: 'head', label: 'Head' },
] as const;

const SEX_OPTIONS = [
  { value: 'female', label: 'Girl' },
  { value: 'male', label: 'Boy' },
] as const;

const FIELD = { weight: 'weightKg', length: 'lengthCm', head: 'headCm' } as const;
const NAME = { weight: 'Weight', length: 'Length', head: 'Head' } as const;

type GrowthViewProps = { child: Child; units: GrowthUnits; now: number };

export function GrowthView({ child, units, now }: GrowthViewProps) {
  const db = useSQLiteContext();
  const [measure, setMeasure] = useState<Measure>('weight');
  const measurements = useDbQuery(['event'], (db) => listEventsOfType(db, child.id, 'growth'), [
    child.id,
  ]);
  if (measurements.status !== 'success') return null;

  const ageMonthsAt = (ms: number) => ageInDays(child.birthDate, new Date(ms)) / DAYS_PER_MONTH;
  const ageNowMonths = ageMonthsAt(now);
  const format = (m: Measure, metric: number) =>
    m === 'weight' ? formatWeight(metric, units) : formatLength(metric, units);
  const percentileText = (m: Measure, event: BabyEvent<'growth'>, metric: number) => {
    if (!child.sex) return null;
    const p = percentileFor(m, child.sex, ageMonthsAt(event.startAt), metric);
    return p === null ? null : formatPercentile(p);
  };

  const withValue = measurements.data.filter((e) => e.data[FIELD[measure]] !== null);
  const latest = withValue[withValue.length - 1];
  const latestValue = latest?.data[FIELD[measure]] ?? null;

  const points: GrowthPoint[] = withValue
    .map((e) => {
      const value = e.data[FIELD[measure]]!;
      const age = formatAge(child.birthDate, new Date(e.startAt));
      const pct = percentileText(measure, e, value);
      return {
        id: e.id,
        ageMonths: ageMonthsAt(e.startAt),
        value,
        description: `${age}: ${format(measure, value)}${pct ? ` · ${pct}` : ''}`,
      };
    })
    .filter((p) => p.ageMonths >= 0 && p.ageMonths <= MAX_CHART_MONTHS);

  const setSex = (sex: Sex) =>
    updateChild(db, child.id, { name: child.name, birthDate: child.birthDate, sex });

  return (
    <View style={styles.container}>
      <Button title="Add measurement" onPress={() => router.push('/log/growth')} />

      {!child.sex && (
        <Card>
          <ThemedText type="smallBold">Which growth chart?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            WHO growth standards are different for girls and boys. Choose one to see percentiles.
          </ThemedText>
          <SegmentedControl options={SEX_OPTIONS} value={null} onChange={setSex} />
        </Card>
      )}

      <SegmentedControl options={MEASURE_OPTIONS} value={measure} onChange={setMeasure} />

      <Animated.View key={measure} entering={Motion.fadeIn}>
        <Card>
          <View style={styles.header}>
            <ThemedText type="smallBold">📏 {NAME[measure]}</ThemedText>
            {latest && latestValue !== null ? (
              <>
                <ThemedText style={styles.headline}>{format(measure, latestValue)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    percentileText(measure, latest, latestValue),
                    `at ${formatAge(child.birthDate, new Date(latest.startAt))}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </>
            ) : (
              <ThemedText themeColor="textSecondary">
                No {NAME[measure].toLowerCase()} logged yet.
              </ThemedText>
            )}
          </View>

          {child.sex && ageNowMonths <= MAX_CHART_MONTHS + 2 ? (
            <GrowthChart
              measure={measure}
              sex={child.sex}
              units={units}
              points={points}
              ageNowMonths={Math.min(ageNowMonths, MAX_CHART_MONTHS)}
              childName={child.name}
            />
          ) : child.sex ? (
            <ThemedText type="small" themeColor="textSecondary">
              The WHO charts here cover birth to 2 years.
            </ThemedText>
          ) : null}
        </Card>
      </Animated.View>

      {measurements.data.length > 0 && (
        <View style={styles.history}>
          <ThemedText type="smallBold">All measurements</ThemedText>
          {[...measurements.data].reverse().map((event) => (
            <MeasurementRow
              key={event.id}
              event={event}
              age={formatAge(child.birthDate, new Date(event.startAt))}
              lines={(['weight', 'length', 'head'] as const)
                .filter((m) => event.data[FIELD[m]] !== null)
                .map((m) => {
                  const value = event.data[FIELD[m]]!;
                  const pct = percentileText(m, event, value);
                  return `${NAME[m]} ${format(m, value)}${pct ? ` (${pct})` : ''}`;
                })}
            />
          ))}
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Percentiles compare with the WHO Child Growth Standards (data via the CDC). They show where
        a measurement falls among healthy children, not whether something is wrong — every baby
        follows their own curve. Talk to your pediatrician about any concerns.
      </ThemedText>
    </View>
  );
}

function MeasurementRow({
  event,
  age,
  lines,
}: {
  event: BabyEvent<'growth'>;
  age: string;
  lines: string[];
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Edit this measurement"
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <ThemedText type="smallBold">
        {new Date(event.startAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}{' '}
        · {age}
      </ThemedText>
      {lines.map((line) => (
        <ThemedText key={line} type="small">
          {line}
        </ThemedText>
      ))}
      {event.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {event.notes}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.four },
  header: { gap: Spacing.half },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
  history: { gap: Spacing.two },
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
});
