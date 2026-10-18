import { useEffect } from 'react';

import type { Child } from '@/db/types';
import { BACKGROUND_RERUN_DELAY_MS } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useSleepPrediction } from '@/hooks/use-sleep-prediction';
import { formatTime } from '@/lib/format';
import { syncSleepReminder } from '@/lib/notifications';

const MINUTE = 60_000;

/**
 * Keeps the scheduled "sleep window opens soon" notification in step with the
 * latest prediction and settings. Renders nothing; mount it once while the app runs.
 */
export function SleepReminderSync({ child }: { child: Child }) {
  const settings = useSettings();
  const sleep = useSleepPrediction(child, { rerunDelayMs: BACKGROUND_RERUN_DELAY_MS });

  const ready = settings.status === 'success' && sleep.status !== 'loading';
  const enabled = settings.data?.sleepReminders ?? false;
  const leadMin = settings.data?.sleepReminderLeadMin ?? 15;
  const opensAt = sleep.status === 'awake' ? sleep.prediction.opensAt : null;
  const closesAt = sleep.status === 'awake' ? sleep.prediction.closesAt : null;

  useEffect(() => {
    if (!ready) return;
    syncSleepReminder(
      enabled && opensAt !== null && closesAt !== null
        ? {
            at: opensAt - leadMin * MINUTE,
            title: `${child.name}'s sleep window opens in ${leadMin} min`,
            body: `Sleep window: ${formatTime(opensAt)} – ${formatTime(closesAt)}`,
          }
        : null,
    ).catch(() => {
      // Scheduling can fail if permission was revoked; the reminder is best-effort.
    });
  }, [ready, enabled, leadMin, opensAt, closesAt, child.name]);

  return null;
}
