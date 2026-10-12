import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { BottleForm } from '@/components/forms/bottle-form';
import { BreastForm } from '@/components/forms/breast-form';
import { DiaperForm } from '@/components/forms/diaper-form';
import {
  bottleAmountMl,
  bottleToValues,
  breastFromValues,
  breastToValues,
  cleanNotes,
  pumpFromValues,
  pumpToValues,
} from '@/components/forms/mapping';
import { GrowthForm } from '@/components/forms/growth-form';
import { growthToValues } from '@/components/forms/growth-mapping';
import { MedicationForm } from '@/components/forms/medication-form';
import { MilestoneForm } from '@/components/forms/milestone-form';
import { PumpForm } from '@/components/forms/pump-form';
import { SleepForm } from '@/components/forms/sleep-form';
import { SolidsForm } from '@/components/forms/solids-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { deleteEvent, getEvent, updateEvent } from '@/db/events';
import type { BabyEvent, EventType } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { successFeedback } from '@/lib/haptics';
import type { GrowthUnits } from '@/lib/growth-units';
import type { VolumeUnit } from '@/lib/units';

const TITLES: Record<EventType, string> = {
  sleep: 'Edit sleep',
  feed_breast: 'Edit breastfeed',
  feed_bottle: 'Edit bottle',
  feed_solids: 'Edit solids',
  diaper: 'Edit diaper',
  medication: 'Edit medication',
  pump: 'Edit pumping',
  growth: 'Edit measurement',
  milestone: 'Edit milestone',
};

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const event = useDbQuery(['event'], (db) => getEvent(db, id), [id]);

  if (settings.status !== 'success' || event.status !== 'success') return null;
  if (!event.data) {
    return (
      <Screen withTabBar={false} belowHeader panel>
        <ThemedText themeColor="textSecondary">This entry no longer exists.</ThemedText>
      </Screen>
    );
  }
  // Keyed so the form's fields reset if a different event is shown.
  return (
    <EditEvent
      key={event.data.id}
      event={event.data}
      unit={settings.data.volumeUnit}
      growthUnits={settings.data.growthUnits}
    />
  );
}

type EditEventProps = { event: BabyEvent; unit: VolumeUnit; growthUnits: GrowthUnits };

function EditEvent({ event, unit, growthUnits }: EditEventProps) {
  const db = useSQLiteContext();

  const done = () => {
    successFeedback();
    router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(db, event.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen withTabBar={false} belowHeader panel>
      <Stack.Screen options={{ title: TITLES[event.type] }} />
      <EventForm event={event} unit={unit} growthUnits={growthUnits} onSaved={done} />
      <Button title="Delete" variant="secondary" onPress={confirmDelete} />
    </Screen>
  );
}

type EventFormProps = EditEventProps & { onSaved: () => void };

function EventForm({ event, unit, growthUnits, onSaved }: EventFormProps) {
  const db = useSQLiteContext();
  const submitLabel = 'Save changes';

  if (event.endAt === null && (event.type === 'sleep' || event.type === 'feed_breast')) {
    return (
      <ThemedText themeColor="textSecondary">
        This timer is still running. Stop it on Home, then you can edit it here.
      </ThemedText>
    );
  }

  switch (event.type) {
    case 'sleep':
      return (
        <SleepForm
          initial={{ startAt: event.startAt, endAt: event.endAt!, notes: event.notes ?? '' }}
          submitLabel={submitLabel}
          onSubmit={async ({ startAt, endAt, notes }) => {
            await updateEvent<'sleep'>(db, event.id, { startAt, endAt, notes: cleanNotes(notes) });
            onSaved();
          }}
        />
      );
    case 'feed_breast':
      return (
        <BreastForm
          initial={breastToValues(event)}
          submitLabel={submitLabel}
          onSubmit={async (values) => {
            await updateEvent<'feed_breast'>(db, event.id, {
              ...breastFromValues(values, event),
              notes: cleanNotes(values.notes),
            });
            onSaved();
          }}
        />
      );
    case 'feed_bottle':
      return (
        <BottleForm
          initial={bottleToValues(event, unit)}
          unit={unit}
          submitLabel={submitLabel}
          onSubmit={async (values) => {
            await updateEvent<'feed_bottle'>(db, event.id, {
              startAt: values.time,
              data: { amountMl: bottleAmountMl(values, unit, event), content: values.content },
              notes: cleanNotes(values.notes),
            });
            onSaved();
          }}
        />
      );
    case 'feed_solids':
      return (
        <SolidsForm
          initial={{ foods: event.data.foods, time: event.startAt, notes: event.notes ?? '' }}
          submitLabel={submitLabel}
          onSubmit={async ({ foods, time, notes }) => {
            await updateEvent<'feed_solids'>(db, event.id, {
              startAt: time,
              data: { foods },
              notes: cleanNotes(notes),
            });
            onSaved();
          }}
        />
      );
    case 'diaper':
      return (
        <DiaperForm
          initial={{ data: event.data, time: event.startAt, notes: event.notes ?? '' }}
          submitLabel={submitLabel}
          onSubmit={async ({ data, time, notes }) => {
            await updateEvent<'diaper'>(db, event.id, {
              startAt: time,
              data,
              notes: cleanNotes(notes),
            });
            onSaved();
          }}
        />
      );
    case 'medication':
      return (
        <MedicationForm
          initial={{
            name: event.data.name,
            dose: event.data.dose,
            time: event.startAt,
            notes: event.notes ?? '',
          }}
          recent={[]}
          showLastGiven={false}
          submitLabel={submitLabel}
          onSubmit={async ({ name, dose, time, notes }) => {
            await updateEvent<'medication'>(db, event.id, {
              startAt: time,
              data: { name, dose },
              notes: cleanNotes(notes),
            });
            onSaved();
          }}
        />
      );
    case 'growth':
      return (
        <GrowthForm
          initial={growthToValues(event, growthUnits)}
          units={growthUnits}
          original={event}
          submitLabel={submitLabel}
          onSubmit={async ({ startAt, data, notes }) => {
            await updateEvent<'growth'>(db, event.id, { startAt, data, notes: cleanNotes(notes) });
            onSaved();
          }}
        />
      );
    case 'pump':
      return (
        <PumpForm
          initial={pumpToValues(event, unit)}
          unit={unit}
          submitLabel={submitLabel}
          onSubmit={async (values) => {
            await updateEvent<'pump'>(db, event.id, {
              ...pumpFromValues(values, unit, event),
              notes: cleanNotes(values.notes),
            });
            onSaved();
          }}
        />
      );
    case 'milestone':
      return (
        <MilestoneForm
          initial={{ text: event.data.text, time: event.startAt, notes: event.notes ?? '' }}
          submitLabel={submitLabel}
          onSubmit={async ({ time, notes }) => {
            await updateEvent<'milestone'>(db, event.id, {
              startAt: time,
              notes: cleanNotes(notes),
            });
            onSaved();
          }}
        />
      );
  }
}
