import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { cleanNotes } from '@/components/forms/mapping';
import { MedicationForm } from '@/components/forms/medication-form';
import { Screen } from '@/components/screen';
import { insertEvent, listRecentMedications } from '@/db/events';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { successFeedback } from '@/lib/haptics';

export default function LogMedicationScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const childId = child?.id;
  const recent = useDbQuery(
    ['event'],
    async (db) => (childId ? listRecentMedications(db, childId, 6) : []),
    [childId],
  );
  const [initial] = useState(() => ({ name: '', dose: '', time: Date.now(), notes: '' }));
  if (!childId || recent.status !== 'success') return null;

  return (
    <Screen withTabBar={false} belowHeader>
      <MedicationForm
        initial={initial}
        recent={recent.data}
        onSubmit={async ({ name, dose, time, notes }) => {
          await insertEvent(db, {
            childId,
            type: 'medication',
            startAt: time,
            data: { name, dose },
            notes: cleanNotes(notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
