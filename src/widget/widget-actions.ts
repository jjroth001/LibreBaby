import type { SQLiteDatabase } from 'expo-sqlite';

import { getEvent, updateEvent } from '@/db/events';
import type { BabyEvent, BreastSide } from '@/db/types';
import { finishBreast, tapSide } from '@/lib/breast';

/** What the widget's buttons do; the names are the widget library's `clickAction`s. */
export const WIDGET_ACTIONS = {
  /** Ends a running sleep. */
  wake: 'WAKE',
  /** Breastfeeding: like tapping a side in the app (switch to it, or pause it if running). */
  side: 'BREAST_SIDE',
  /** Ends a running breastfeed. */
  done: 'BREAST_DONE',
} as const;

export type WidgetActionData = { eventId?: unknown; side?: unknown };

/**
 * Applies a widget button tap. The widget can be a few minutes out of date, so a tap only
 * changes the timer if it's still running (stopped on another phone or in the app since:
 * nothing happens). Returns whether anything changed.
 */
export async function applyWidgetAction(
  db: SQLiteDatabase,
  action: string,
  data: WidgetActionData,
  now: number,
): Promise<boolean> {
  if (typeof data.eventId !== 'string') return false;
  const event = await getEvent(db, data.eventId);
  if (!event || event.endAt !== null) return false;

  if (action === WIDGET_ACTIONS.wake && event.type === 'sleep') {
    await updateEvent<'sleep'>(db, event.id, { endAt: now });
    return true;
  }
  if (event.type !== 'feed_breast') return false;
  const feed = event as BabyEvent<'feed_breast'>;

  if (action === WIDGET_ACTIONS.side && (data.side === 'L' || data.side === 'R')) {
    const side: BreastSide = data.side;
    await updateEvent<'feed_breast'>(db, feed.id, { data: tapSide(feed.data, side, now) });
    return true;
  }
  if (action === WIDGET_ACTIONS.done) {
    await updateEvent<'feed_breast'>(db, feed.id, {
      endAt: now,
      data: finishBreast(feed.data, now),
    });
    return true;
  }
  return false;
}

/** The "Switch side" / "Resume" button: the other side while feeding, the last side if paused. */
export function switchTarget(activeSide: BreastSide | null, lastSide: BreastSide): BreastSide {
  if (activeSide === null) return lastSide;
  return activeSide === 'L' ? 'R' : 'L';
}
