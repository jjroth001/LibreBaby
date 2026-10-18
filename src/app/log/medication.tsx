import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert } from 'react-native';

import { cleanNotes } from '@/components/forms/mapping';
import { MedicationForm } from '@/components/forms/medication-form';
import { choiceFor, RemindNextDose, type RemindChoice } from '@/components/forms/remind-next-dose';
import { Screen } from '@/components/screen';
import { insertEvent, listRecentMedications } from '@/db/events';
import { setSetting } from '@/db/settings';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { successFeedback } from '@/lib/haptics';
import {
  afterDoseReminder,
  dailyReminder,
  describeSchedule,
  prefillFromReminder,
  withAfterDoseChoice,
  type MedReminder,
} from '@/lib/med-reminders';
import { remindersSupported, requestNotificationPermission } from '@/lib/notifications';

const DEFAULT_HOURS = 6;

/** The panel's starting state for this medicine: its existing reminder, or off. */
function defaultChoice(reminders: MedReminder[], name: string): RemindChoice {
  const existing = name ? afterDoseReminder(reminders, name) : undefined;
  return choiceFor(existing?.hours ?? DEFAULT_HOURS, existing?.enabled ?? false);
}

export default function LogMedicationScreen() {
  const db = useSQLiteContext();
  // Only a reminder id comes in from outside; the medicine and dose are looked up here.
  const params = useLocalSearchParams<{ reminder?: string }>();
  const { data: child } = useChild();
  const settings = useSettings();
  const childId = child?.id;
  const recent = useDbQuery(
    ['event'],
    async (db) => (childId ? listRecentMedications(db, childId, 6) : []),
    [childId],
  );
  const [openedAt] = useState(Date.now);
  // Null until the switch or hours are touched; until then it follows the typed medicine.
  const [choice, setChoice] = useState<RemindChoice | null>(null);
  if (!childId || recent.status !== 'success' || settings.status !== 'success') return null;
  const reminders = settings.data.medReminders;
  // Filled in when opened from a reminder notification. The form reads this only when it
  // first appears, so later settings changes don't overwrite what's been typed.
  const initial = {
    ...prefillFromReminder(reminders, params.reminder),
    time: openedAt,
    notes: '',
  };

  return (
    <Screen withTabBar={false} belowHeader panel>
      <MedicationForm
        initial={initial}
        recent={recent.data}
        renderExtra={({ name, time }) => {
          const daily = name ? dailyReminder(reminders, name) : undefined;
          return (
            <RemindNextDose
              value={choice ?? defaultChoice(reminders, name)}
              onChange={setChoice}
              givenAt={time}
              dailyNote={daily && describeSchedule(daily)}
            />
          );
        }}
        onSubmit={async ({ name, dose, time, notes }) => {
          await insertEvent(db, {
            childId,
            type: 'medication',
            startAt: time,
            data: { name, dose },
            notes: cleanNotes(notes),
          });
          const remind = choice ?? defaultChoice(reminders, name);
          const next = remindersSupported
            ? withAfterDoseChoice(reminders, { name, dose }, remind, randomUUID)
            : null;
          if (next) {
            await setSetting(db, 'medReminders', next);
            if (remind.on && !(await requestNotificationPermission())) {
              Alert.alert(
                'Notifications are off',
                'The reminder is saved, but Android won’t show it until notifications are allowed for LibreBaby in your phone’s settings.',
              );
            }
          }
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
