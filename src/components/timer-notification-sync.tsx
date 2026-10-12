import { LiveTimer } from '@modules/live-timer/src';
import { useEffect } from 'react';

import { listRunningTimers, TIMER_TYPES } from '@/db/events';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { requestNotificationPermission } from '@/lib/notifications';
import { timerNotification } from '@/lib/timer-notification';

/**
 * Shows an ongoing notification with a live clock while a sleep or breastfeed timer runs
 * (including one started on another family phone), and removes it when the timer stops.
 * The clock is Android's own, so it keeps counting with the app closed. Renders nothing.
 */
export function TimerNotificationSync() {
  if (!LiveTimer) return null; // Expo Go
  return <TimerNotificationSyncInner />;
}

function TimerNotificationSyncInner() {
  const { data: child } = useChild();
  const settings = useSettings();
  const childId = child?.id;
  const running = useDbQuery(
    ['event'],
    async (db) => (childId ? listRunningTimers(db, childId) : []),
    [childId],
  );
  const enabled = settings.data?.timerNotifications ?? true;

  useEffect(() => {
    const native = LiveTimer;
    if (!native || !child || running.status !== 'success') return;
    const timers = enabled ? running.data : [];
    let cancelled = false;

    (async () => {
      // Asks once, the first time there's something to show (Android 13+).
      if (timers.length > 0 && !(await requestNotificationPermission())) return;
      if (cancelled) return;
      const now = Date.now();
      const shown = new Set<string>();
      for (const event of timers) {
        const n = timerNotification(event, child.name, now);
        native.show(n.key, n.title, n.text, n.startAt, n.running);
        shown.add(n.key);
      }
      for (const type of TIMER_TYPES) if (!shown.has(type)) native.hide(type);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [child, running, enabled]);

  return null;
}
