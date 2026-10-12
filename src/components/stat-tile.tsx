import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type StatTileProps = { title: string; value?: string | null; detail?: string };

/** Small labeled number, laid out in rows of three. */
export function StatTile({ title, value, detail }: StatTileProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText style={styles.value}>{value ?? '—'}</ThemedText>
      {detail ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {detail}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  value: { fontSize: 18, fontWeight: 700 },
});
