import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChildForm } from '@/components/child-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { updateChild } from '@/db/children';
import { useChild } from '@/db/use-child';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  if (!child) return null;

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  saved: { textAlign: 'center' },
});
