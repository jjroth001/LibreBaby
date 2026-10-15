import { router } from 'expo-router';
import { useEffect } from 'react';

import { lastMedicationTimes } from '@/db/events';
import type { Child } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { planMedReminders } from '@/lib/med-reminders';
import { onMedReminderTapped, syncMedReminders } from '@/lib/notifications';

/**
 * Keeps scheduled medicine reminders in step with the reminder settings and the latest
 * logged doses (from any family phone), and opens the medication log, filled in, when one
 * is tapped. Renders nothing; mount it once while the app runs.
 */
export function MedReminderSync({ child }: { child: Child }) {
  const settings = useSettings();
  const lastGiven = useDbQuery(['event'], (db) => lastMedicationTimes(db, child.id), [child.id]);

  const reminders = settings.data?.medReminders;
  const last = lastGiven.data;

  useEffect(() => {
    if (!reminders || !last) return;
    syncMedReminders(planMedReminders(reminders, last, Date.now())).catch(() => {
      // Scheduling can fail if permission was revoked; reminders are best-effort.
    });
  }, [reminders, last]);

  useEffect(
    () =>
      onMedReminderTapped(({ name, dose }) =>
        router.push({ pathname: '/log/medication', params: { name, dose } }),
      ),
    [],
  );

  return null;
}
