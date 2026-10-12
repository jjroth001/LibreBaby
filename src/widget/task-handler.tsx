import { LiveTimer } from '@modules/live-timer/src';
import { openDatabaseAsync } from 'expo-sqlite';
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { SCENES } from '@/lib/sky';

import { FallbackWidget, LibreBabyWidget } from './librebaby-widget';
import { loadWidgetModel } from './load-widget-model';
import type { WidgetModel } from './widget-model';

/** Reads straight from the app's database; works even when the app isn't open. */
async function loadModel(): Promise<WidgetModel> {
  // Its own connection: without useNewConnection, expo-sqlite may hand back the running
  // app's cached one, and closing it below would break the app.
  const db = await openDatabaseAsync('librebaby.db', { useNewConnection: true });
  try {
    return await loadWidgetModel(db, Date.now());
  } catch {
    // e.g. the app was updated but not opened yet, so the database isn't migrated.
    return { kind: 'empty', scene: SCENES.night };
  } finally {
    await db.closeAsync();
  }
}

/** "Time since" goes stale between Android's 30-minute updates; redraw more often. */
export const WIDGET_REFRESH_MINUTES = 10;

function keepRefreshing() {
  try {
    // Re-arms (or, after the last widget is removed, cancels) the refresh alarm.
    LiveTimer?.scheduleWidgetRefresh(WIDGET_REFRESH_MINUTES);
  } catch {
    // Best effort: Android's own 30-minute updates still apply.
  }
}

/** Android calls this to draw the widget: when added, resized, and on its update schedule. */
export const widgetTaskHandler: WidgetTaskHandler = async ({
  widgetAction,
  widgetInfo,
  renderWidget,
}) => {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      keepRefreshing();
      try {
        renderWidget(
          <LibreBabyWidget
            model={await loadModel()}
            width={widgetInfo.width}
            height={widgetInfo.height}
          />,
        );
      } catch (error) {
        console.error('LibreBaby widget failed to draw', error);
        renderWidget(<FallbackWidget />);
      }
      break;
    case 'WIDGET_DELETED':
      keepRefreshing();
      break;
    default:
      // Taps use OPEN_APP, handled natively.
      break;
  }
};
