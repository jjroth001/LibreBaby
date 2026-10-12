import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { BreastForm } from '@/components/forms/breast-form';
import { breastFromValues, cleanNotes } from '@/components/forms/mapping';
import { Screen } from '@/components/screen';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { successFeedback } from '@/lib/haptics';

const MINUTE = 60_000;

/** Log a breastfeed after the fact, with minutes per side. */
export default function LogBreastfeedScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [initial] = useState(() => ({
    startAt: Date.now() - 30 * MINUTE,
    leftMin: 10,
    rightMin: 10,
    endedOn: 'R' as const,
    notes: '',
  }));
  if (!child) return null;

  return (
    <Screen withTabBar={false} belowHeader>
      <BreastForm
        initial={initial}
        onSubmit={async (values) => {
          await insertEvent(db, {
            childId: child.id,
            type: 'feed_breast',
            ...breastFromValues(values),
            notes: cleanNotes(values.notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
