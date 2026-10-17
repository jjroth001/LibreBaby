import type { IconName } from '@/components/icons/icon-paths';
import type { TimerType } from '@/db/events';
import type { SleepState } from '@/db/sleep-state';
import type { BabyEvent, BreastSide, Child } from '@/db/types';
import { sideTotals } from '@/lib/breast';
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
  | {
      kind: 'ready';
      scene: Scene;
      childName: string;
      rows: WidgetRow[];
      /** A running sleep or breastfeed: the widget shows it (with buttons) instead of rows. */
      timer: WidgetTimer | null;
    };

export type WidgetRow = { icon: IconName; label: string; value: string; detail: string };

export type WidgetTimer =
  | { kind: 'sleep'; eventId: string; elapsed: string; since: string }
  | {
      kind: 'breast';
      eventId: string;
      left: string;
      right: string;
      /** The side being fed on; null while paused. */
      activeSide: BreastSide | null;
      lastSide: BreastSide;
    };

/** Minutes between redraws: a running timer's minutes should keep up; otherwise "ago" times. */
export function widgetRefreshMinutes(model: WidgetModel): number {
  return model.kind === 'ready' && model.timer ? 1 : 10;
}

/** The running timer to show: the most recently started, if more than one is running. */
export function widgetTimer(timers: BabyEvent<TimerType>[], now: number): WidgetTimer | null {
  const latest = timers.reduce<BabyEvent<TimerType> | null>(
    (a, b) => (a && a.startAt >= b.startAt ? a : b),
    null,
  );
  if (!latest) return null;
  if (latest.type === 'sleep') {
    return {
      kind: 'sleep',
      eventId: latest.id,
      elapsed: formatDuration(now - latest.startAt),
      since: widgetTime(latest.startAt, now),
    };
  }
  const { data } = latest as BabyEvent<'feed_breast'>;
  const { leftMs, rightMs } = sideTotals(data, now);
  return {
    kind: 'breast',
    eventId: latest.id,
    left: formatDuration(leftMs),
    right: formatDuration(rightMs),
    activeSide: data.activeSide,
    lastSide: data.lastSide,
  };
}

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
  /** Sleep and breastfeeding timers still running. */
  timers: BabyEvent<TimerType>[];
  unit: VolumeUnit;
  growthUnits: GrowthUnits;
  now: number;
  /** The sky at `now`, so the widget matches the app. */
  scene: Scene;
};

export function buildWidgetModel(input: ModelInput): WidgetModel {
  const { child, lastFeed, lastDiaper, sleep, timers, unit, growthUnits, now, scene } = input;
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

  return {
    kind: 'ready',
    scene,
    childName: child.name,
    rows: [feed, sleepRow, diaper],
    timer: widgetTimer(timers, now),
  };
}
