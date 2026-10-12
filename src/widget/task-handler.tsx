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
    default:
      // WIDGET_DELETED needs no cleanup; taps use OPEN_APP, handled natively.
      break;
  }
};
