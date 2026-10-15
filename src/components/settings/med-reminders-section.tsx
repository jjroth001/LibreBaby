import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { CardTitle } from '@/components/card-title';
import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { lastMedicationTimes } from '@/db/events';
import { setSetting, type Settings } from '@/db/settings';
import type { Child } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatDayTime } from '@/lib/format';
import { describeSchedule, medKey, planMedReminders, type MedReminder } from '@/lib/med-reminders';
import { remindersSupported, requestNotificationPermission } from '@/lib/notifications';

/** Settings › Medicine reminders: each reminder with an on/off switch, and Add. */
export function MedRemindersSection({ child, settings }: { child: Child; settings: Settings }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const now = useNow(60_000);
  const lastGiven = useDbQuery(['event'], (db) => lastMedicationTimes(db, child.id), [child.id]);
  const reminders = settings.medReminders;

  const toggle = async (reminder: MedReminder, on: boolean) => {
    if (on && !(await requestNotificationPermission())) {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for this app in Android Settings to get medicine reminders.',
      );
      return;
    }
    await setSetting(
      db,
      'medReminders',
      reminders.map((r) => (r.id === reminder.id ? { ...r, enabled: on } : r)),
    );
  };

  const nextLine = (reminder: MedReminder): string => {
    const schedule = describeSchedule(reminder);
    if (!reminder.enabled || !lastGiven.data) return schedule;
    const next = planMedReminders([reminder], lastGiven.data, now)[0];
    if (next) return `${schedule} · next ${formatDayTime(next.at, now)}`;
    if (reminder.kind === 'after' && !lastGiven.data.has(medKey(reminder.name)))
      return `${schedule} · starts with the next dose`;
    return schedule;
  };

  return (
    <Card>
      <CardTitle icon="pill">Medicine reminders</CardTitle>
      {!remindersSupported && (
        <ThemedText type="small" themeColor="textSecondary">
          Available in the installed app. Expo Go (the development preview) can’t show these
          notifications.
        </ThemedText>
      )}
      {reminders.map((reminder) => (
        <Animated.View
          key={reminder.id}
          entering={Motion.enter}
          exiting={Motion.exit}
          layout={Motion.layout}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens this reminder to change it"
            onPress={() => router.push({ pathname: '/med-reminder', params: { id: reminder.id } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
            ]}>
            <Icon name="pill" size={22} color={theme.accent} />
            <View style={styles.label}>
              <ThemedText type="smallBold">
                {reminder.dose ? `${reminder.name} · ${reminder.dose}` : reminder.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {nextLine(reminder)}
              </ThemedText>
            </View>
            <Switch
              disabled={!remindersSupported}
              value={remindersSupported && reminder.enabled}
              onValueChange={(on) => toggle(reminder, on)}
              trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
              thumbColor="#FFFFFF"
              accessibilityLabel={`${reminder.name} reminder`}
            />
          </Pressable>
        </Animated.View>
      ))}
      <Animated.View layout={Motion.layout} style={styles.footer}>
        <Button
          title="Add a reminder"
          variant="secondary"
          disabled={!remindersSupported}
          onPress={() => router.push('/med-reminder')}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {reminders.length > 0 ? 'Tap a reminder to change it. ' : ''}Reminders stay on this phone;
          doses logged on any family phone count.
        </ThemedText>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  label: { flex: 1, gap: Spacing.half },
  footer: { gap: Spacing.three },
});
