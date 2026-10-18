import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { setSetting, type Settings } from '@/db/settings';
import type { Child } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { remindersSupported, requestNotificationPermission } from '@/lib/notifications';

const LEAD_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
] as const;
type LeadOption = (typeof LEAD_OPTIONS)[number]['value'];

/** Settings › Notifications: sleep window reminders and the running-timer notification. */
export function NotificationsSection({ child, settings }: { child: Child; settings: Settings }) {
  const db = useSQLiteContext();
  const theme = useTheme();

  const toggleReminders = async (on: boolean) => {
    if (on && !(await requestNotificationPermission())) {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for this app in Android Settings to get sleep window reminders.',
      );
      return;
    }
    await setSetting(db, 'sleepReminders', on);
  };

  return (
    <Card>
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <ThemedText type="smallBold">Sleep window reminders</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {remindersSupported
              ? `Get a notification before ${child.name}'s next sleep window opens.`
              : 'Available in the installed app. Expo Go (the development preview) can’t show these notifications.'}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Sleep window reminders"
          disabled={!remindersSupported}
          value={remindersSupported && settings.sleepReminders}
          onValueChange={toggleReminders}
          trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
          thumbColor="#FFFFFF"
        />
      </View>
      {remindersSupported && settings.sleepReminders && (
        <SegmentedControl
          options={LEAD_OPTIONS}
          value={String(settings.sleepReminderLeadMin) as LeadOption}
          onChange={(lead) => setSetting(db, 'sleepReminderLeadMin', Number(lead))}
        />
      )}
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <ThemedText type="smallBold">Running timer in notifications</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            While a sleep or feed timer runs, show it with a live clock in your notifications.
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Running timer in notifications"
          disabled={!remindersSupported}
          value={remindersSupported && settings.timerNotifications}
          onValueChange={(on) => setSetting(db, 'timerNotifications', on)}
          trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
          thumbColor="#FFFFFF"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchLabel: { flex: 1, gap: Spacing.half },
});
