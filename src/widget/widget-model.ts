import type { IconName } from '@/components/icons/icon-paths';
import type { SleepState } from '@/db/sleep-state';
import type { BabyEvent, Child } from '@/db/types';
import { startOfLocalDay } from '@/lib/dates';
import { describeEvent } from '@/lib/describe';
import { formatDuration, formatTime } from '@/lib/format';
import type { GrowthUnits } from '@/lib/growth-units';
import type { Scene } from '@/lib/sky';
import type { VolumeUnit } from '@/lib/units';

/** Must match the widget `name` in app.json's react-native-android-widget plugin config. */
export const WIDGET_NAME = 'LibreBaby';

/** What the home-screen widget shows; built from data, rendered by `LibreBabyWidget`. */
export type WidgetModel =
  | { kind: 'empty'; scene: Scene }
  | { kind: 'ready'; scene: Scene; childName: string; rows: WidgetRow[] };

export type WidgetRow = { icon: IconName; label: string; value: string; detail: string };

/** Clock time, with the weekday for anything before today ("Sun 9:00 PM"). */
export function widgetTime(ms: number, now: number): string {
  const time = formatTime(ms);
  if (startOfLocalDay(ms) === startOfLocalDay(now)) return time;
  const day = new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });
  return `${day} ${time}`;
}

/**
 * "1h 20m ago". Computed when the widget is drawn, which happens whenever something is
 * logged and every ~10 minutes while the phone is awake; the clock time goes alongside
 * in the detail, which is exact whenever you look.
 */
export function widgetAgo(ms: number, now: number): string {
  return now - ms < 60_000 ? 'Just now' : `${formatDuration(now - ms)} ago`;
}

type ModelInput = {
  child: Child | null;
  lastFeed: BabyEvent | null;
  lastDiaper: BabyEvent | null;
  sleep: SleepState;
  unit: VolumeUnit;
  growthUnits: GrowthUnits;
  now: number;
  /** The sky at `now`, so the widget matches the app. */
  scene: Scene;
};

export function buildWidgetModel(input: ModelInput): WidgetModel {
  const { child, lastFeed, lastDiaper, sleep, unit, growthUnits, now, scene } = input;
  if (!child) return { kind: 'empty', scene };

  const describe = (event: BabyEvent) => describeEvent(event, unit, growthUnits);

  const feed: WidgetRow = lastFeed
    ? {
        icon: 'bottle',
        label: 'Last feed',
        value: widgetAgo(lastFeed.startAt, now),
        detail: `${widgetTime(lastFeed.startAt, now)} · ${describe(lastFeed)}`,
      }
    : { icon: 'bottle', label: 'Last feed', value: '—', detail: 'Nothing logged yet' };

  const sleepRow: WidgetRow =
    sleep.status === 'sleeping'
      ? {
          icon: 'moon-stars',
          label: 'Asleep since',
          value: widgetTime(sleep.since, now),
          detail: '',
        }
      : sleep.status === 'awake'
        ? {
            icon: 'moon-stars',
            label: 'Next sleep',
            value: `${formatTime(sleep.prediction.opensAt)} – ${formatTime(sleep.prediction.closesAt)}`,
            detail: '',
          }
        : { icon: 'moon-stars', label: 'Next sleep', value: '—', detail: 'Log a sleep to see it' };

  const diaper: WidgetRow = lastDiaper
    ? {
        icon: 'diaper',
        label: 'Last diaper',
        value: widgetAgo(lastDiaper.startAt, now),
        detail: `${widgetTime(lastDiaper.startAt, now)} · ${describe(lastDiaper)}`,
      }
    : { icon: 'diaper', label: 'Last diaper', value: '—', detail: 'Nothing logged yet' };

  return { kind: 'ready', scene, childName: child.name, rows: [feed, sleepRow, diaper] };
}
