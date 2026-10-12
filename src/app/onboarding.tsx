import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';

import { ChildForm } from '@/components/child-form';
import { SubmitButton } from '@/components/forms/submit-button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { importBackup } from '@/db/backup';
import { createChild } from '@/db/children';
import { pickBackup } from '@/lib/data-transfer';

export default function OnboardingScreen() {
  const db = useSQLiteContext();

  // Restoring brings back the profile too, which moves us on to the tabs.
  const restore = async () => {
    try {
      const backup = await pickBackup();
      if (!backup) return;
      if (backup.children.length === 0) {
        Alert.alert('Couldn’t restore', 'This backup doesn’t contain a baby profile.');
        return;
      }
      await importBackup(db, backup);
    } catch (error) {
      Alert.alert('Couldn’t restore', (error as Error).message);
    }
  };

  return (
    <Screen withTabBar={false}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Welcome to LibreBaby</ThemedText>
        <ThemedText themeColor="textSecondary">
          Let&apos;s start with a few details. Everything stays on this phone.
        </ThemedText>
      </View>
      {/* Saving flips the root navigator's guard, which moves us to the tabs automatically. */}
      <ChildForm
        submitLabel="Get started"
        onSubmit={async (values) => {
          await createChild(db, values);
        }}
      />

      <View style={styles.restore}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Moving to a new phone?
        </ThemedText>
        <SubmitButton
          title="Restore from a backup"
          busyTitle="Opening…"
          variant="secondary"
          onPress={restore}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginTop: Spacing.five },
  restore: { gap: Spacing.two, marginTop: Spacing.four },
  center: { textAlign: 'center' },
});
