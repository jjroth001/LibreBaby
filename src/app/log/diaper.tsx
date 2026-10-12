import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { DiaperForm } from '@/components/forms/diaper-form';
import { cleanNotes } from '@/components/forms/mapping';
import { Screen } from '@/components/screen';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

/** Log a diaper at a specific time (the Home buttons log "now"). */
export default function LogDiaperScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [initial] = useState(() => ({
    data: { wet: true, dirty: false },
    time: Date.now(),
    notes: '',
  }));
  if (!child) return null;

  return (
    <Screen withTabBar={false} belowHeader panel>
      <DiaperForm
        initial={initial}
        onSubmit={async ({ data, time, notes }) => {
          await insertEvent(db, {
            childId: child.id,
            type: 'diaper',
            startAt: time,
            data,
            notes: cleanNotes(notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
