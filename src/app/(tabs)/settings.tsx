import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { CardTitle } from '@/components/card-title';
import { ChildForm } from '@/components/child-form';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { AppearanceSection } from '@/components/settings/appearance-section';
import { DataSection } from '@/components/settings/data-section';
import { SyncSection } from '@/components/settings/sync-section';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { updateChild } from '@/db/children';
import { setSetting } from '@/db/settings';
import { useChild } from '@/db/use-child';
import { useSettings } from '@/db/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { remindersSupported, requestNotificationPermission } from '@/lib/notifications';

const LEAD_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
] as const;
type LeadOption = (typeof LEAD_OPTIONS)[number]['value'];

const GROWTH_UNIT_OPTIONS = [
  { value: 'imperial', label: 'lb & in' },
  { value: 'metric', label: 'kg & cm' },
] as const;

const VOLUME_OPTIONS = [
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'ml', label: 'Milliliters (ml)' },
] as const;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const { data: settings } = useSettings();
  const theme = useTheme();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  if (!child || !settings) return null;

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
    <Screen>
      <ThemedText style={styles.title}>Settings</ThemedText>

      <Card>
        <CardTitle icon="baby">Baby profile</CardTitle>
        <ChildForm
          key={child.id}
          initialValues={{
            name: child.name,
            birthDate: child.birthDate,
            sex: child.sex,
          }}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await updateChild(db, child.id, values);
            setSavedAt(Date.now());
          }}
        />
        {savedAt !== null && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.saved}>
            Saved
          </ThemedText>
        )}
      </Card>

      <AppearanceSection settings={settings} />

      <Card>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <CardTitle icon="bell">Sleep window reminders</CardTitle>
            <ThemedText type="small" themeColor="textSecondary">
              {remindersSupported
                ? `Get a notification before ${child.name}'s next sleep window opens.`
                : 'Available in the installed app. Expo Go (the development preview) can’t show these notifications.'}
            </ThemedText>
          </View>
          <Switch
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
      </Card>

      <Card>
        <ThemedText type="smallBold">Bottle units</ThemedText>
        <SegmentedControl
          options={VOLUME_OPTIONS}
          value={settings.volumeUnit}
          onChange={(unit) => setSetting(db, 'volumeUnit', unit)}
        />
        <ThemedText type="smallBold">Growth units</ThemedText>
        <SegmentedControl
          options={GROWTH_UNIT_OPTIONS}
          value={settings.growthUnits}
          onChange={(units) => setSetting(db, 'growthUnits', units)}
        />
      </Card>

      <SyncSection child={child} />

      <DataSection
        child={child}
        unit={settings.volumeUnit}
        growthUnits={settings.growthUnits}
        lastBackupAt={settings.lastBackupAt}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 42, fontWeight: 400 },
  saved: { textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchLabel: { flex: 1, gap: Spacing.half },
});
