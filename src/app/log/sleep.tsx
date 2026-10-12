import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { cleanNotes } from '@/components/forms/mapping';
import { SleepForm } from '@/components/forms/sleep-form';
import { Screen } from '@/components/screen';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

const HOUR = 60 * 60 * 1000;

/** Log a sleep after the fact (for when nobody started the timer). */
export default function LogSleepScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [initial] = useState(() => {
    const now = Date.now();
    return { startAt: now - HOUR, endAt: now, notes: '' };
  });
  if (!child) return null;

  return (
    <Screen withTabBar={false} belowHeader panel>
      <SleepForm
        initial={initial}
        onSubmit={async ({ startAt, endAt, notes }) => {
          await insertEvent(db, {
            childId: child.id,
            type: 'sleep',
            startAt,
            endAt,
            data: {},
            notes: cleanNotes(notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
