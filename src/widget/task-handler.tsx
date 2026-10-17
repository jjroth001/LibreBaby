import { LiveTimer } from '@modules/live-timer/src';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { getChild } from '@/db/children';
import { notifyDbChanged } from '@/db/db-changes';
import { listRunningTimers, TIMER_TYPES } from '@/db/events';
import { getSettings } from '@/db/settings';
import { SCENES } from '@/lib/sky';
import { timerNotification } from '@/lib/timer-notification';

import { FedWidget, SleepTileWidget, UpNextWidget } from './extra-widgets';
import { FallbackWidget, LibreBabyWidget } from './librebaby-widget';
import { loadModelFor, loadRefreshMinutes, type AnyWidgetModel } from './load-widget-model';
import { loadAllModels, redrawAllWidgets } from './redraw';
import { applyWidgetAction } from './widget-actions';
import { WIDGET_NAMES } from './widget-model';

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

/** The widget's picture for its current data. */
function draw(loaded: AnyWidgetModel, width: number, height: number) {
  switch (loaded.name) {
    case WIDGET_NAMES.upNext:
      return <UpNextWidget model={loaded.model} width={width} height={height} />;
    case WIDGET_NAMES.fed:
      return <FedWidget model={loaded.model} width={width} height={height} />;
    case WIDGET_NAMES.sleep:
      return <SleepTileWidget model={loaded.model} width={width} height={height} />;
    default:
      return <LibreBabyWidget model={loaded.model} width={width} height={height} />;
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
function keepRefreshing(minutes: number) {
  try {
    // Re-arms (or, after the last widget is removed, cancels) the refresh alarm.
    LiveTimer?.scheduleWidgetRefresh(minutes);
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
        const { loaded, minutes, others, changed } = await withDb(async (db) => {
          // Taps on the timer's buttons; the rest of each widget opens the app or the
          // Oracle, which Android handles without us.
          let changed = false;
          if (widgetAction === 'WIDGET_CLICK' && clickAction) {
            changed = await applyWidgetAction(
              db,
              clickAction,
              clickActionData ?? {},
              Date.now(),
            ).catch(() => false);
            if (changed) await syncTimerNotifications(db).catch(() => {});
          }
          const now = Date.now();
          return {
            loaded: await loadModelFor(db, widgetInfo.widgetName, now).catch(
              // e.g. the app was updated but not opened yet, so the database isn't migrated.
              (): AnyWidgetModel => ({
                name: WIDGET_NAMES.main,
                model: { kind: 'empty', scene: SCENES.night },
              }),
            ),
            minutes: await loadRefreshMinutes(db).catch(() => 10),
            // A tap changes what the other widgets show too (e.g. the sleep tile).
            others: changed ? await loadAllModels(db).catch(() => null) : null,
            changed,
          };
        });
        // If the app is open, its screens heard about the tap before it was committed and
        // may have re-read the old data; now that it's saved, have them read again.
        if (changed) notifyDbChanged(['event']);
        keepRefreshing(minutes);
        renderWidget(draw(loaded, widgetInfo.width, widgetInfo.height));
        if (others) await redrawAllWidgets(others).catch(() => {});
      } catch (error) {
        console.error('LibreBaby widget failed to draw', error);
        keepRefreshing(10);
        renderWidget(<FallbackWidget />);
      }
      break;
    case 'WIDGET_DELETED':
      keepRefreshing(10);
      break;
  }
};
