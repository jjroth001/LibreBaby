import { LiveTimer } from '@modules/live-timer/src';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { getChild } from '@/db/children';
import { listRunningTimers, TIMER_TYPES } from '@/db/events';
import { getSettings } from '@/db/settings';
import { SCENES } from '@/lib/sky';
import { timerNotification } from '@/lib/timer-notification';

import { FallbackWidget, LibreBabyWidget } from './librebaby-widget';
import { applyWidgetAction } from './widget-actions';
import { loadWidgetModel } from './load-widget-model';
import { widgetRefreshMinutes, type WidgetModel } from './widget-model';

/**
 * The widget's own connection to the app's database; works even when the app isn't open.
 * Without useNewConnection, expo-sqlite may hand back the running app's cached one, and
 * closing it afterwards would break the app. With enableChangeListener, writes made here
 * (button taps) reach the app's screens, which update just as for a sync.
 */
async function withDb<R>(work: (db: SQLiteDatabase) => Promise<R>): Promise<R> {
  const db = await openDatabaseAsync('librebaby.db', {
    useNewConnection: true,
    enableChangeListener: true,
  });
  try {
    // Wait out a write from the app or background sync instead of failing as "locked".
    await db.execAsync('PRAGMA busy_timeout = 5000;');
    return await work(db);
  } finally {
    await db.closeAsync();
  }
}

async function loadModel(db: SQLiteDatabase): Promise<WidgetModel> {
  try {
    return await loadWidgetModel(db, Date.now());
  } catch {
    // e.g. the app was updated but not opened yet, so the database isn't migrated.
    return { kind: 'empty', scene: SCENES.night };
  }
}

/**
 * Brings the running-timer notification in line after a tap: the app does this itself
 * while it runs, but it may be closed.
 */
async function syncTimerNotifications(db: SQLiteDatabase) {
  const native = LiveTimer;
  if (!native) return;
  const [child, settings] = await Promise.all([getChild(db), getSettings(db)]);
  if (!child) return;
  const timers = settings.timerNotifications ? await listRunningTimers(db, child.id) : [];
  const now = Date.now();
  const shown = new Set<string>();
  for (const event of timers) {
    const n = timerNotification(event, child.name, now);
    native.show(n.key, n.title, n.text, n.startAt, n.running);
    shown.add(n.key);
  }
  for (const type of TIMER_TYPES) if (!shown.has(type)) native.hide(type);
}

/** How often to redraw: every minute while a timer runs, so its minutes keep up. */
function keepRefreshing(model: WidgetModel | null) {
  try {
    // Re-arms (or, after the last widget is removed, cancels) the refresh alarm.
    LiveTimer?.scheduleWidgetRefresh(model ? widgetRefreshMinutes(model) : 10);
  } catch {
    // Best effort: Android's own 30-minute updates still apply.
  }
}

/** Android calls this to draw the widget (when added, resized, on its schedule) and on taps. */
export const widgetTaskHandler: WidgetTaskHandler = async ({
  widgetAction,
  widgetInfo,
  clickAction,
  clickActionData,
  renderWidget,
}) => {
  switch (widgetAction) {
    case 'WIDGET_CLICK':
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      try {
        const model = await withDb(async (db) => {
          // Taps on the timer's buttons; the rest of the widget uses OPEN_APP, handled natively.
          if (widgetAction === 'WIDGET_CLICK' && clickAction) {
            const changed = await applyWidgetAction(
              db,
              clickAction,
              clickActionData ?? {},
              Date.now(),
            ).catch(() => false);
            if (changed) await syncTimerNotifications(db).catch(() => {});
          }
          return loadModel(db);
        });
        keepRefreshing(model);
        renderWidget(
          <LibreBabyWidget model={model} width={widgetInfo.width} height={widgetInfo.height} />,
        );
      } catch (error) {
        console.error('LibreBaby widget failed to draw', error);
        keepRefreshing(null);
        renderWidget(<FallbackWidget />);
      }
      break;
    case 'WIDGET_DELETED':
      keepRefreshing(null);
      break;
  }
};
