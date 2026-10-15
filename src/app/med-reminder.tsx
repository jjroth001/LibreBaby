import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { SubmitButton } from '@/components/forms/submit-button';
import { Icon } from '@/components/icons/icon';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { listRecentMedications } from '@/db/events';
import { setSetting } from '@/db/settings';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import { formatMinutes, sortedTimes, type MedReminder } from '@/lib/med-reminders';
import { requestNotificationPermission } from '@/lib/notifications';

const KIND_OPTIONS = [
  { value: 'after', label: 'After each dose' },
  { value: 'times', label: 'Set times' },
] as const;

const HOUR_OPTIONS = [
  { value: '4', label: '4 h' },
  { value: '6', label: '6 h' },
  { value: '8', label: '8 h' },
  { value: 'other', label: 'Other' },
] as const;
type HourOption = (typeof HOUR_OPTIONS)[number]['value'];
const PRESET_HOURS = [4, 6, 8];

/** Add a medicine reminder (no id) or change one (`id`), from Settings. */
export default function MedReminderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const settings = useSettings();
  const { data: child } = useChild();
  const childId = child?.id;
  const recent = useDbQuery(
    ['event'],
    async (db) => (childId ? listRecentMedications(db, childId, 6) : []),
    [childId],
  );
  if (settings.status !== 'success' || recent.status !== 'success') return null;
  const reminders = settings.data.medReminders;
  const existing = id ? reminders.find((r) => r.id === id) : undefined;

  return (
    <Screen withTabBar={false} belowHeader panel>
      <ReminderForm reminders={reminders} existing={existing} recent={recent.data} />
    </Screen>
  );
}

function ReminderForm({
  reminders,
  existing,
  recent,
}: {
  reminders: MedReminder[];
  existing: MedReminder | undefined;
  recent: { name: string; dose: string }[];
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [name, setName] = useState(existing?.name ?? '');
  const [dose, setDose] = useState(existing?.dose ?? '');
  const [kind, setKind] = useState<MedReminder['kind']>(existing?.kind ?? 'after');
  const [hours, setHours] = useState(existing?.hours ?? 6);
  const [customHours, setCustomHours] = useState(!PRESET_HOURS.includes(hours));
  const [times, setTimes] = useState<number[]>(existing?.times ?? [8 * 60]);

  const pickTime = (index: number | null) => {
    const start = index === null ? 20 * 60 : times[index];
    DateTimePickerAndroid.open({
      mode: 'time',
      value: new Date(2000, 0, 1, Math.floor(start / 60), start % 60),
      onValueChange: (_event, picked) => {
        const minutes = picked.getHours() * 60 + picked.getMinutes();
        const next =
          index === null ? [...times, minutes] : times.map((t, i) => (i === index ? minutes : t));
        setTimes(sortedTimes(next));
      },
    });
  };

  const save = async () => {
    const reminder: MedReminder = {
      id: existing?.id ?? randomUUID(),
      name: name.trim(),
      dose: dose.trim(),
      enabled: existing?.enabled ?? true,
      kind,
      hours,
      times: sortedTimes(times),
    };
    await setSetting(
      db,
      'medReminders',
      existing
        ? reminders.map((r) => (r.id === existing.id ? reminder : r))
        : [...reminders, reminder],
    );
    if (reminder.enabled && !(await requestNotificationPermission())) {
      Alert.alert(
        'Notifications are off',
        'The reminder is saved, but Android won’t show it until notifications are allowed for LibreBaby in your phone’s settings.',
      );
    }
    router.back();
  };

  const remove = () =>
    Alert.alert('Delete this reminder?', 'Logged doses stay; only the reminder goes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await setSetting(
            db,
            'medReminders',
            reminders.filter((r) => r.id !== existing?.id),
          );
          router.back();
        },
      },
    ]);

  const canSave = name.trim().length > 0 && (kind === 'after' || times.length > 0);
  const chipStyle = (pressed: boolean) => [
    styles.chip,
    { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
  ];

  return (
    <>
      {!existing && recent.length > 0 && (
        <View style={styles.chips}>
          {recent.map((med) => (
            <Pressable
              key={`${med.name}|${med.dose}`}
              accessibilityRole="button"
              onPress={() => {
                setName(med.name);
                setDose(med.dose);
              }}
              style={({ pressed }) => chipStyle(pressed)}>
              <ThemedText type="small">
                {med.dose ? `${med.name} · ${med.dose}` : med.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <TextField
        label="Medication"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Vitamin D"
        autoCapitalize="words"
      />
      <TextField label="Dose" value={dose} onChangeText={setDose} placeholder="Optional" />

      <ThemedText type="smallBold" themeColor="textSecondary">
        WHEN
      </ThemedText>
      <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} />

      {kind === 'after' ? (
        <Animated.View
          key="after"
          entering={Motion.fadeIn}
          layout={Motion.layout}
          style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <SegmentedControl
            options={HOUR_OPTIONS}
            value={(customHours ? 'other' : String(hours)) as HourOption}
            onChange={(option) => {
              if (option === 'other') return setCustomHours(true);
              setCustomHours(false);
              setHours(Number(option));
            }}
          />
          {customHours && (
            <Animated.View entering={Motion.enter} exiting={Motion.exit} layout={Motion.layout}>
              <Stepper
                value={hours}
                onChange={(h) => setHours(Math.min(72, h))}
                step={1}
                min={1}
                suffix="h"
                integer
                size="medium"
                accessibilityName="hours after each dose"
              />
            </Animated.View>
          )}
          <Animated.View layout={Motion.layout}>
            <ThemedText type="small" themeColor="textSecondary">
              Counts from the latest dose logged on any family phone.
            </ThemedText>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View
          key="times"
          entering={Motion.fadeIn}
          layout={Motion.layout}
          style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.chips}>
            {times.map((minutes, index) => (
              <Animated.View
                key={minutes}
                entering={Motion.fadeIn}
                exiting={Motion.exit}
                layout={Motion.layout}
                style={[styles.timeChip, { backgroundColor: theme.backgroundSelected }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Change this time"
                  onPress={() => pickTime(index)}
                  style={styles.timeLabel}>
                  <ThemedText type="smallBold">{formatMinutes(minutes)}</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${formatMinutes(minutes)}`}
                  hitSlop={8}
                  onPress={() => {
                    tapFeedback();
                    setTimes(times.filter((_, i) => i !== index));
                  }}
                  style={styles.remove}>
                  <Icon name="x" size={16} color={theme.textSecondary} duotone={false} />
                </Pressable>
              </Animated.View>
            ))}
            <Animated.View layout={Motion.layout}>
              <Pressable
                accessibilityRole="button"
                onPress={() => pickTime(null)}
                style={({ pressed }) => [
                  styles.addChip,
                  { borderColor: theme.textSecondary },
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                <Icon name="plus" size={16} color={theme.text} duotone={false} />
                <ThemedText type="small">Add time</ThemedText>
              </Pressable>
            </Animated.View>
          </View>
          <Animated.View layout={Motion.layout}>
            <ThemedText type="small" themeColor="textSecondary">
              Every day. Skipped if a dose was already logged in the hour before.
            </ThemedText>
          </Animated.View>
        </Animated.View>
      )}

      <Animated.View layout={Motion.layout} style={styles.actions}>
        <SubmitButton title="Save" onPress={save} disabled={!canSave} />
        {existing && <Button title="Delete reminder" variant="secondary" onPress={remove} />}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: 20,
    justifyContent: 'center',
  },
  panel: { borderRadius: 20, padding: Spacing.three, gap: Spacing.three },
  timeChip: {
    minHeight: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
  },
  timeLabel: { minHeight: 44, justifyContent: 'center' },
  remove: {
    minHeight: 44,
    paddingHorizontal: Spacing.two + Spacing.half,
    justifyContent: 'center',
  },
  addChip: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  actions: { gap: Spacing.three },
});
