import type { IconName } from '@/components/icons/icon-paths';
import { itemIcon, itemName } from '@/components/oracle/oracle-style';
import type { SleepState } from '@/db/sleep-state';
import type { BabyEvent, BreastSide } from '@/db/types';
import { formatDuration, formatTime } from '@/lib/format';
import type { Confidence, Forecast } from '@/lib/oracle';
import type { Scene } from '@/lib/sky';

import { widgetTime } from './widget-model';

/* Up next: the Oracle's next few estimates --------------------------------------------- */

export type UpNextItem = {
  id: string;
  icon: IconName;
  /** Clock time, or "Now" when it's due. */
  time: string;
  name: string;
  confidence: Confidence;
};

export type UpNextModel =
  | { kind: 'empty'; scene: Scene }
  | { kind: 'ready'; scene: Scene; childName: string; items: UpNextItem[] };

/** How many estimates fit on the 4×3 widget. */
export const UP_NEXT_COUNT = 4;

export function buildUpNextModel(
  scene: Scene,
  childName: string | null,
  forecast: Forecast | null,
): UpNextModel {
  if (childName === null || forecast === null) return { kind: 'empty', scene };
  const items = [...forecast.items]
    .sort((a, b) => a.at - b.at)
    .slice(0, UP_NEXT_COUNT)
    .map((item) => ({
      id: item.id,
      icon: itemIcon(item) as IconName,
      time: item.due ? 'Now' : formatTime(item.at),
      name: itemName(item),
      confidence: item.confidence,
    }));
  return { kind: 'ready', scene, childName, items };
}

/* Fed: time since the last feed --------------------------------------------------------- */

export type FedModel =
  | { kind: 'empty'; scene: Scene }
  | {
      kind: 'ready';
      scene: Scene;
      /** "2h 10m", "Now" while breastfeeding, or "—". */
      value: string;
      detail: string;
      /** The breast to start on next, if the last breastfeed was in the past day. */
      nextSide: string | null;
    };

const DAY = 24 * 60 * 60_000;
const SIDE_NAME: Record<BreastSide, string> = { L: 'Left', R: 'Right' };

type FedInput = {
  scene: Scene;
  hasChild: boolean;
  /** Latest finished feed of any kind. */
  lastFeed: BabyEvent | null;
  /** Latest finished breastfeed. */
  lastBreast: BabyEvent<'feed_breast'> | null;
  breastfeeding: boolean;
  now: number;
};

export function buildFedModel(input: FedInput): FedModel {
  const { scene, hasChild, lastFeed, lastBreast, breastfeeding, now } = input;
  if (!hasChild) return { kind: 'empty', scene };
  if (breastfeeding) {
    return { kind: 'ready', scene, value: 'Now', detail: 'Breastfeeding', nextSide: null };
  }
  const nextSide =
    lastBreast && now - lastBreast.startAt < DAY
      ? SIDE_NAME[lastBreast.data.lastSide === 'L' ? 'R' : 'L']
      : null;
  if (!lastFeed) return { kind: 'ready', scene, value: '—', detail: 'No feeds yet', nextSide };
  const ago = now - lastFeed.startAt;
  return {
    kind: 'ready',
    scene,
    value: ago < 60_000 ? 'Just now' : formatDuration(ago),
    detail:
      ago < 60_000
        ? widgetTime(lastFeed.startAt, now)
        : `ago · ${widgetTime(lastFeed.startAt, now)}`,
    nextSide,
  };
}

/* Next sleep: a ring that fills up toward the sleep window -------------------------------- */

export type SleepTileModel =
  | { kind: 'empty'; scene: Scene }
  | {
      kind: 'ready';
      scene: Scene;
      title: string;
      value: string;
      detail: string;
      footer: string;
      /** How far through the awake time toward the window, 0–1; null hides the ring. */
      progress: number | null;
    };

export function buildSleepTileModel(
  scene: Scene,
  hasChild: boolean,
  sleep: SleepState,
  now: number,
): SleepTileModel {
  if (!hasChild) return { kind: 'empty', scene };
  if (sleep.status === 'sleeping') {
    return {
      kind: 'ready',
      scene,
      title: 'Asleep',
      value: formatDuration(now - sleep.since),
      detail: `since ${widgetTime(sleep.since, now)}`,
      footer: '',
      progress: null,
    };
  }
  if (sleep.status === 'no-data') {
    return {
      kind: 'ready',
      scene,
      title: 'Next sleep',
      value: '—',
      detail: 'Log a sleep',
      footer: '',
      progress: null,
    };
  }
  const { lastWokeAt, prediction } = sleep;
  const { opensAt, closesAt } = prediction;
  const span = Math.max(1, opensAt - lastWokeAt);
  const progress = Math.min(1, Math.max(0, (now - lastWokeAt) / span));
  const [value, detail] =
    now < opensAt
      ? [formatDuration(opensAt - now), `at ${formatTime(opensAt)}`]
      : now <= closesAt
        ? ['Now', `until ${formatTime(closesAt)}`]
        : ['Due', `from ${formatTime(opensAt)}`];
  return {
    kind: 'ready',
    scene,
    title: 'Next sleep',
    value,
    detail,
    footer: `Awake ${formatDuration(now - lastWokeAt)}`,
    progress,
  };
}

/** A ring for the sleep tile: a faint full track, and an arc from the top, clockwise. */
export function ringSvg(progress: number, size: number, track: string, color: string): string {
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const p = Math.min(0.9999, Math.max(0, progress));
  const angle = -Math.PI / 2 + p * 2 * Math.PI;
  const x = c + r * Math.cos(angle);
  const y = c + r * Math.sin(angle);
  const large = p > 0.5 ? 1 : 0;
  const arc =
    p > 0
      ? `<path d="M${c} ${c - r} A${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>${arc}</svg>`;
}
