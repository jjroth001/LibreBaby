import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Card } from '@/components/card';
import { BarChart, type Bar } from '@/components/insights/bar-chart';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { listEvents } from '@/db/events';
import type { Child } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useNow } from '@/hooks/use-now';
import { addLocalDays, startOfLocalDay } from '@/lib/dates';
import { formatDuration } from '@/lib/format';
import { buildInsights, type DayInsight } from '@/lib/insights';
import { formatVolume, type VolumeUnit } from '@/lib/units';

const RANGE_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
] as const;
type Range = (typeof RANGE_OPTIONS)[number]['value'];

export default function InsightsScreen() {
  const { data: child } = useChild();
  if (!child) return null;
  return <Insights child={child} />;
}

/** Axis labels: weekday initials for a week, otherwise every few days as M/D. */
function barsFor(days: DayInsight[], pick: (d: DayInsight) => number): Bar[] {
  const every = days.length <= 7 ? 1 : days.length <= 14 ? 2 : 7;
  return days.map((day, index) => {
    const date = new Date(day.dayStart);
    const fromEnd = days.length - 1 - index;
    const label =
      days.length <= 7
        ? date.toLocaleDateString(undefined, { weekday: 'narrow' })
        : fromEnd % every === 0
          ? `${date.getMonth() + 1}/${date.getDate()}`
          : '';
    return {
      key: String(day.dayStart),
      label,
      longLabel: day.partial
        ? 'Today'
        : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      value: pick(day),
      partial: day.partial,
    };
  });
}

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString();

function Insights({ child }: { child: Child }) {
  const settings = useSettings();
  const now = useNow(60_000);
  const todayStart = startOfLocalDay(now);
  const [range, setRange] = useState<Range>('7');
  const dayCount = Number(range);
  // One extra day back so sleeps that began the night before the range are included.
  const from = addLocalDays(todayStart, -dayCount);
  const events = useDbQuery(
    ['event'],
    (db) => listEvents(db, child.id, from, addLocalDays(todayStart, 1)),
    [child.id, from, todayStart],
  );

  if (settings.status !== 'success' || events.status !== 'success') return null;
  const unit: VolumeUnit = settings.data.volumeUnit;
  const insights = buildInsights(events.data, todayStart, dayCount, now);
  const avg = insights.averages;
  const hasBottles = insights.days.some((d) => d.bottleMl > 0);
  const hasPumping = insights.days.some((d) => d.pumpMl > 0);

  return (
    <Screen>
      <ThemedText type="subtitle">Insights</ThemedText>
      <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />

      {!avg ? (
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          Trends show up here once you&apos;ve logged a full day. Today counts tomorrow.
        </ThemedText>
      ) : (
        // Keyed by range so switching ranges cross-fades the charts.
        <Animated.View key={range} entering={Motion.fadeIn} style={styles.sections}>
          <ThemedText type="small" themeColor="textSecondary">
            Averages use the {insights.loggedDays} complete{' '}
            {insights.loggedDays === 1 ? 'day' : 'days'} with entries; today is shown faded.
          </ThemedText>

          <Section
            title="😴 Sleep"
            headline={`${formatDuration(avg.sleepMs)} / day`}
            details={[
              avg.longestSleepMs > 0 &&
                `Longest stretch ${formatDuration(avg.longestSleepMs)} on average`,
              insights.typicalWakeWindowMs !== null &&
                `Typically awake ${formatDuration(insights.typicalWakeWindowMs)} between daytime sleeps`,
            ]}>
            <BarChart
              title="Sleep per day"
              bars={barsFor(insights.days, (d) => d.sleepMs)}
              format={formatDuration}
              average={avg.sleepMs}
            />
          </Section>

          <Section
            title="🍼 Feeds"
            headline={`${oneDecimal(avg.feedCount)} / day`}
            details={[hasBottles && `${formatVolume(avg.bottleMl, unit)} from bottles per day`]}>
            <BarChart
              title="Feeds per day"
              bars={barsFor(insights.days, (d) => d.feedCount)}
              format={(n) => oneDecimal(n)}
              average={avg.feedCount}
            />
          </Section>

          {hasBottles && (
            <Section
              title="🍼 Bottle volume"
              headline={`${formatVolume(avg.bottleMl, unit)} / day`}>
              <BarChart
                title="Bottle volume per day"
                bars={barsFor(insights.days, (d) => d.bottleMl)}
                format={(ml) => formatVolume(ml, unit)}
                average={avg.bottleMl}
              />
            </Section>
          )}

          <Section
            title="🧷 Diapers"
            headline={`${oneDecimal(avg.diaperCount)} / day`}
            details={[
              `${oneDecimal(avg.wetCount)} wet · ${oneDecimal(avg.dirtyCount)} dirty on average`,
            ]}>
            <BarChart
              title="Diapers per day"
              bars={barsFor(insights.days, (d) => d.diaperCount)}
              format={(n) => oneDecimal(n)}
              average={avg.diaperCount}
            />
          </Section>

          {hasPumping && (
            <Section title="🥛 Pumping" headline={`${formatVolume(avg.pumpMl, unit)} / day`}>
              <BarChart
                title="Pumped per day"
                bars={barsFor(insights.days, (d) => d.pumpMl)}
                format={(ml) => formatVolume(ml, unit)}
                average={avg.pumpMl}
              />
            </Section>
          )}
        </Animated.View>
      )}
    </Screen>
  );
}

type SectionProps = {
  title: string;
  headline: string;
  details?: (string | false)[];
  children: React.ReactNode;
};

function Section({ title, headline, details = [], children }: SectionProps) {
  const lines = details.filter(Boolean) as string[];
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText style={styles.headline}>{headline}</ThemedText>
        {lines.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  sections: { gap: Spacing.four },
  sectionHeader: { gap: Spacing.half },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: 700 },
  empty: { textAlign: 'center', marginTop: Spacing.four },
});
