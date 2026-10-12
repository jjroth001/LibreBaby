import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useChild } from '@/db/use-child';
import { formatAge } from '@/lib/dates';

export default function HomeScreen() {
  const { data: child } = useChild();
  if (!child) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="subtitle">{child.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{formatAge(child.birthDate)} old</ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Coming next (M2)</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          One-tap logging for sleep, feeds and diapers will live here.
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});
