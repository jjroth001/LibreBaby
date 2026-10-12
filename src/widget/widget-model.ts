import type { SleepState } from '@/db/sleep-state';
import type { BabyEvent, Child } from '@/db/types';
import { startOfLocalDay } from '@/lib/dates';
import { describeEvent } from '@/lib/describe';
import { formatTime } from '@/lib/format';
import type { GrowthUnits } from '@/lib/growth-units';
import type { VolumeUnit } from '@/lib/units';

/** Must match the widget `name` in app.json's react-native-android-widget plugin config. */
export const WIDGET_NAME = 'LibreBaby';

/** What the home-screen widget shows; built from data, rendered by `LibreBabyWidget`. */
export type WidgetModel =
  { kind: 'empty' } | { kind: 'ready'; childName: string; rows: WidgetRow[] };

export type WidgetRow = { label: string; value: string; detail: string };

/**
 * Widgets only refresh every ~30 minutes on their own, so we show clock times (always
 * right) rather than "x minutes ago" (stale between refreshes). Older than today gets
 * the weekday too, so yesterday's 9 PM feed isn't mistaken for tonight's.
 */
export function widgetTime(ms: number, now: number): string {
  const time = formatTime(ms);
  if (startOfLocalDay(ms) === startOfLocalDay(now)) return time;
  const day = new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });
  return `${day} ${time}`;
}

type ModelInput = {
  child: Child | null;
  lastFeed: BabyEvent | null;
  lastDiaper: BabyEvent | null;
  sleep: SleepState;
  unit: VolumeUnit;
  growthUnits: GrowthUnits;
  now: number;
};

export function buildWidgetModel(input: ModelInput): WidgetModel {
  const { child, lastFeed, lastDiaper, sleep, unit, growthUnits, now } = input;
  if (!child) return { kind: 'empty' };

  const describe = (event: BabyEvent) => describeEvent(event, unit, growthUnits);

  const feed: WidgetRow = lastFeed
    ? { label: 'Last feed', value: widgetTime(lastFeed.startAt, now), detail: describe(lastFeed) }
    : { label: 'Last feed', value: '—', detail: 'Nothing logged yet' };

  const sleepRow: WidgetRow =
    sleep.status === 'sleeping'
      ? { label: 'Asleep since', value: widgetTime(sleep.since, now), detail: '' }
      : sleep.status === 'awake'
        ? {
            label: 'Next sleep',
            value: `${formatTime(sleep.prediction.opensAt)} – ${formatTime(sleep.prediction.closesAt)}`,
            detail: '',
          }
        : { label: 'Next sleep', value: '—', detail: 'Log a sleep to see it' };

  const diaper: WidgetRow = lastDiaper
    ? {
        label: 'Last diaper',
        value: widgetTime(lastDiaper.startAt, now),
        detail: describe(lastDiaper),
      }
    : { label: 'Last diaper', value: '—', detail: 'Nothing logged yet' };

  return { kind: 'ready', childName: child.name, rows: [feed, sleepRow, diaper] };
}
