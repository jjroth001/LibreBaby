import type { TimerType } from '@/db/events';
import type { BabyEvent } from '@/db/types';

import { sideTotals } from './breast';
import { formatDuration, formatTime } from './format';

/** What the ongoing notification for a running timer says. */
export type TimerNotification = {
  /** One notification per timer type, so a new sleep replaces the last one's. */
  key: TimerType;
  title: string;
  text: string;
  /** The instant the notification's clock counts up from. */
  startAt: number;
  /** false: no ticking clock (a paused breastfeed). */
  running: boolean;
};

const SIDE = { L: 'left', R: 'right' } as const;

export function timerNotification(
  event: BabyEvent<TimerType>,
  childName: string,
  now: number,
): TimerNotification {
  if (event.type === 'sleep') {
    return {
      key: 'sleep',
      title: `${childName} is sleeping`,
      text: `Fell asleep at ${formatTime(event.startAt)}`,
      startAt: event.startAt,
      running: true,
    };
  }

  // The clock shows the feed's total, so it counts from "now minus the time so far".
  const breast = event as BabyEvent<'feed_breast'>;
  const { leftMs, rightMs } = sideTotals(breast.data, now);
  const sides = `Left ${formatDuration(leftMs)} · Right ${formatDuration(rightMs)}`;
  const active = breast.data.activeSide;
  return {
    key: 'feed_breast',
    title: active ? `Breastfeeding on the ${SIDE[active]}` : 'Breastfeeding paused',
    text: active ? sides : `${formatDuration(leftMs + rightMs)} so far · ${sides}`,
    startAt: now - (leftMs + rightMs),
    running: active !== null,
  };
}
