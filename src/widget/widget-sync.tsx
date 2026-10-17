import { LiveTimer } from '@modules/live-timer/src';
import { useEffect } from 'react';

import { useDbQuery } from '@/db/use-db-query';
import { widgetsSupported } from '@/lib/platform';

import { loadAllModels, redrawAllWidgets, type Models } from './redraw';
import { widgetRefreshMinutes } from './widget-model';

/**
 * Redraws any home-screen widgets whenever what they show changes, so a feed logged in
 * the app appears on the widget right away (instead of at its next ~10-minute refresh).
 * Renders nothing; mount once while the app runs.
 */
export function WidgetSync() {
  if (!widgetsSupported) return null;
  return <WidgetSyncInner />;
}

function WidgetSyncInner() {
  const models = useDbQuery(['event', 'child', 'setting'], loadAllModels);
  const key = models.status === 'success' ? JSON.stringify(models.data) : null;

  useEffect(() => {
    if (key === null) return;
    const next = JSON.parse(key) as Models;
    // Keeps the widgets' times fresh: every minute while a timer runs, else every 10
    // (also re-armed after the phone restarts, which clears alarms).
    try {
      LiveTimer?.scheduleWidgetRefresh(widgetRefreshMinutes(next.main));
    } catch {
      // Best effort: Android's own 30-minute updates still apply.
    }
    redrawAllWidgets(next).catch(() => {
      // Best-effort: the widgets will still refresh on their own schedule.
    });
  }, [key]);

  return null;
}
