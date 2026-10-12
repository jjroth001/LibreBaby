import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { GrowthForm } from '@/components/forms/growth-form';
import { cleanNotes } from '@/components/forms/mapping';
import { Screen } from '@/components/screen';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { useSettings } from '@/db/use-settings';
import { successFeedback } from '@/lib/haptics';

export default function LogGrowthScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const { data: settings } = useSettings();
  const [initial] = useState(() => ({
    time: Date.now(),
    weightA: '',
    weightB: '',
    length: '',
    head: '',
    notes: '',
  }));
  if (!child || !settings) return null;

  return (
    <Screen withTabBar={false} belowHeader>
      <GrowthForm
        initial={initial}
        units={settings.growthUnits}
        onSubmit={async ({ startAt, data, notes }) => {
          await insertEvent(db, {
            childId: child.id,
            type: 'growth',
            startAt,
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
