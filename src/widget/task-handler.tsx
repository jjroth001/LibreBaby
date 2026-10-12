import { openDatabaseAsync } from 'expo-sqlite';
import type { WidgetTaskHandler } from 'react-native-android-widget';

import { LibreBabyWidget } from './librebaby-widget';
import { loadWidgetModel } from './load-widget-model';
import type { WidgetModel } from './widget-model';

/** Reads straight from the app's database; works even when the app isn't open. */
async function loadModel(): Promise<WidgetModel> {
  const db = await openDatabaseAsync('librebaby.db');
  try {
    return await loadWidgetModel(db, Date.now());
  } catch {
    // e.g. the app was updated but not opened yet, so the database isn't migrated.
    return { kind: 'empty' };
  } finally {
    await db.closeAsync();
  }
}

/** Android calls this to draw the widget: when added, resized, and on its update schedule. */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      renderWidget(<LibreBabyWidget model={await loadModel()} />);
      break;
    default:
      // WIDGET_DELETED needs no cleanup; taps use OPEN_APP, handled natively.
      break;
  }
};
