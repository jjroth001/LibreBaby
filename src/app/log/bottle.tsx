import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { BottleForm } from '@/components/forms/bottle-form';
import { bottleAmountMl, cleanNotes } from '@/components/forms/mapping';
import { Screen } from '@/components/screen';
import { getLatestEvent, insertEvent } from '@/db/events';
import type { BabyEvent } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { successFeedback } from '@/lib/haptics';
import { fromMl, VOLUME_PRESETS, type VolumeUnit } from '@/lib/units';

export default function LogBottleScreen() {
  const child = useChild();
  const settings = useSettings();
  const childId = child.data?.id;
  const last = useDbQuery(
    ['event'],
    async (db) => (childId ? getLatestEvent(db, childId, ['feed_bottle']) : null),
    [childId],
  );

  if (!childId || settings.status !== 'success' || last.status !== 'success') return null;
  return <LogBottle childId={childId} unit={settings.data.volumeUnit} last={last.data} />;
}

type LogBottleProps = { childId: string; unit: VolumeUnit; last: BabyEvent<'feed_bottle'> | null };

function LogBottle({ childId, unit, last }: LogBottleProps) {
  const db = useSQLiteContext();
  // Prefill with the previous bottle — most days it's the same amount and content.
  const [initial] = useState(() => ({
    amount: last ? fromMl(last.data.amountMl, unit) : VOLUME_PRESETS[unit].quick[3],
    content: last?.data.content ?? ('breast_milk' as const),
    time: Date.now(),
    notes: '',
  }));

  return (
    <Screen withTabBar={false} belowHeader panel>
      <BottleForm
        initial={initial}
        unit={unit}
        onSubmit={async (values) => {
          await insertEvent(db, {
            childId,
            type: 'feed_bottle',
            startAt: values.time,
            data: { amountMl: bottleAmountMl(values, unit), content: values.content },
            notes: cleanNotes(values.notes),
          });
          successFeedback();
          router.back();
        }}
      />
    </Screen>
  );
}
