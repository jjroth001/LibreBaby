import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { cleanNotes } from '@/components/forms/mapping';
import { SolidsForm } from '@/components/forms/solids-form';
import { Screen } from '@/components/screen';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

export default function LogSolidsScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [initial] = useState(() => ({ foods: [], time: Date.now(), notes: '' }));
  if (!child) return null;

  return (
    <Screen withTabBar={false} belowHeader>
      <SolidsForm
        initial={initial}
        onSubmit={async ({ foods, time, notes }) => {
          await insertEvent(db, {
            childId: child.id,
            type: 'feed_solids',
            startAt: time,
            data: { foods },
            notes: cleanNotes(notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
