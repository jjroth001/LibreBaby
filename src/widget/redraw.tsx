import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReactElement } from 'react';

import {
  loadFedModel,
  loadSleepTileModel,
  loadUpNextModel,
  loadWidgetModel,
} from './load-widget-model';
import { WIDGET_NAMES } from './widget-model';

export type Models = {
  main: Awaited<ReturnType<typeof loadWidgetModel>>;
  upNext: Awaited<ReturnType<typeof loadUpNextModel>>;
  fed: Awaited<ReturnType<typeof loadFedModel>>;
  sleep: Awaited<ReturnType<typeof loadSleepTileModel>>;
};

export async function loadAllModels(db: SQLiteDatabase): Promise<Models> {
  const now = Date.now();
  const [main, upNext, fed, sleep] = await Promise.all([
    loadWidgetModel(db, now),
    loadUpNextModel(db, now),
    loadFedModel(db, now),
    loadSleepTileModel(db, now),
  ]);
  return { main, upNext, fed, sleep };
}

/** Redraws every LibreBaby widget on the home screen. */
export async function redrawAllWidgets(models: Models) {
  // Loaded lazily: these modules touch native code that doesn't exist in Expo Go.
  const [{ requestWidgetUpdate }, main, extra] = await Promise.all([
    import('react-native-android-widget'),
    import('./librebaby-widget'),
    import('./extra-widgets'),
  ]);
  const { FallbackWidget } = main;
  // The library turns the element into a widget after renderWidget returns, so a drawing
  // error surfaces from requestWidgetUpdate itself; fall back rather than stay blank.
  const update = async (widgetName: string, draw: (w?: number, h?: number) => ReactElement) => {
    try {
      await requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => draw(info.width, info.height),
      });
    } catch (error) {
      console.error('LibreBaby widget failed to draw', error);
      await requestWidgetUpdate({ widgetName, renderWidget: () => <FallbackWidget /> });
    }
  };
  // Widgets that aren't on the home screen are skipped by the library.
  await Promise.all([
    update(WIDGET_NAMES.main, (width, height) => (
      <main.LibreBabyWidget model={models.main} width={width} height={height} />
    )),
    update(WIDGET_NAMES.upNext, (width, height) => (
      <extra.UpNextWidget model={models.upNext} width={width} height={height} />
    )),
    update(WIDGET_NAMES.fed, (width, height) => (
      <extra.FedWidget model={models.fed} width={width} height={height} />
    )),
    update(WIDGET_NAMES.sleep, (width, height) => (
      <extra.SleepTileWidget model={models.sleep} width={width} height={height} />
    )),
  ]);
}
