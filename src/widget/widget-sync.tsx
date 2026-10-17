import { LiveTimer } from '@modules/live-timer/src';
import { useEffect } from 'react';

import { useDbQuery } from '@/db/use-db-query';
import { widgetsSupported } from '@/lib/platform';

import { loadWidgetModel } from './load-widget-model';
import { WIDGET_NAME, widgetRefreshMinutes, type WidgetModel } from './widget-model';

async function redraw(model: WidgetModel) {
  // Loaded lazily: these modules touch native code that doesn't exist in Expo Go.
  const [{ requestWidgetUpdate }, { FallbackWidget, LibreBabyWidget }] = await Promise.all([
    import('react-native-android-widget'),
    import('./librebaby-widget'),
  ]);
  // The library turns the element into a widget after renderWidget returns, so a drawing
  // error surfaces from requestWidgetUpdate itself; fall back rather than stay blank.
  try {
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => (
        <LibreBabyWidget model={model} width={info.width} height={info.height} />
      ),
    });
  } catch (error) {
    console.error('LibreBaby widget failed to draw', error);
    await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => <FallbackWidget /> });
  }
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
    const next = JSON.parse(key) as WidgetModel;
    // Keeps the widget's times fresh: every minute while a timer runs, else every 10
    // (also re-armed after the phone restarts, which clears alarms).
    try {
      LiveTimer?.scheduleWidgetRefresh(widgetRefreshMinutes(next));
    } catch {
      // Best effort: Android's own 30-minute updates still apply.
    }
    redraw(next).catch(() => {
      // Best-effort: the widget will still refresh on its own schedule.
    });
  }, [key]);

  return null;
}
