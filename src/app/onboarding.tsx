import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, View } from 'react-native';

import { ChildForm } from '@/components/child-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createChild } from '@/db/children';

export default function OnboardingScreen() {
  const db = useSQLiteContext();

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, marginTop: Spacing.five },
});
