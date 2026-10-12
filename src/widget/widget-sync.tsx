import { useEffect } from 'react';

import { useDbQuery } from '@/db/use-db-query';
import { widgetsSupported } from '@/lib/platform';

import { loadWidgetModel } from './load-widget-model';
import { WIDGET_NAME, type WidgetModel } from './widget-model';

async function redraw(model: WidgetModel) {
  // Loaded lazily: these modules touch native code that doesn't exist in Expo Go.
  const [{ requestWidgetUpdate }, { LibreBabyWidget }] = await Promise.all([
    import('react-native-android-widget'),
    import('./librebaby-widget'),
  ]);
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <LibreBabyWidget model={model} />,
  });
}

/**
 * Redraws any home-screen widgets whenever what they show changes, so a feed logged in
 * the app appears on the widget right away (instead of at its next ~30-minute refresh).
 * Renders nothing; mount once while the app runs.
 */
export function WidgetSync() {
  if (!widgetsSupported) return null;
  return <WidgetSyncInner />;
}

function WidgetSyncInner() {
  const model = useDbQuery(['event', 'child', 'setting'], (db) => loadWidgetModel(db, Date.now()));
  const key = model.status === 'success' ? JSON.stringify(model.data) : null;

  useEffect(() => {
    if (key === null) return;
    redraw(JSON.parse(key) as WidgetModel).catch(() => {
      // Best-effort: the widget will still refresh on its own schedule.
    });
  }, [key]);

  return null;
}
