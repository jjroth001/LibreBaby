import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChildForm } from '@/components/child-form';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { updateChild } from '@/db/children';
import { setSetting } from '@/db/settings';
import { useChild } from '@/db/use-child';
import { useSettings } from '@/db/use-settings';

const VOLUME_OPTIONS = [
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'ml', label: 'Milliliters (ml)' },
] as const;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const { data: settings } = useSettings();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  if (!child || !settings) return null;

  return (
    <Screen>
      <ThemedText type="subtitle">Settings</ThemedText>

      <View style={styles.section}>
        <ThemedText type="smallBold">Baby profile</ThemedText>
        <ChildForm
          key={child.id}
          initialValues={{ name: child.name, birthDate: child.birthDate }}
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
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Bottle units</ThemedText>
        <SegmentedControl
          options={VOLUME_OPTIONS}
          value={settings.volumeUnit}
          onChange={(unit) => setSetting(db, 'volumeUnit', unit)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  saved: { textAlign: 'center' },
});
