import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { cleanNotes, pumpFromValues } from '@/components/forms/mapping';
import { PumpForm } from '@/components/forms/pump-form';
import { Screen } from '@/components/screen';
import { insertEvent } from '@/db/events';
import { useChild } from '@/db/use-child';
import { useSettings } from '@/db/use-settings';
import { successFeedback } from '@/lib/haptics';

const MINUTE = 60_000;

export default function LogPumpScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const { data: settings } = useSettings();
  const [initial] = useState(() => ({
    startAt: Date.now() - 15 * MINUTE,
    minutes: 15,
    leftAmount: 0,
    rightAmount: 0,
    notes: '',
  }));
  if (!child || !settings) return null;
  const unit = settings.volumeUnit;

  return (
    <Screen withTabBar={false} belowHeader>
      <PumpForm
        initial={initial}
        unit={unit}
        onSubmit={async (values) => {
          await insertEvent(db, {
            childId: child.id,
            type: 'pump',
            ...pumpFromValues(values, unit),
            notes: cleanNotes(values.notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
