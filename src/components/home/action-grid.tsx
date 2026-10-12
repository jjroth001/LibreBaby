import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Action = {
  key: string;
  emoji: string;
  label: string;
  detail?: string;
  onPress: () => void;
};

/** Two-column grid of big, thumb-friendly buttons. */
export function ActionGrid({ actions }: { actions: Action[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.detail ? `${action.label}, ${action.detail}` : action.label}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
          ]}>
          <ThemedText style={styles.emoji}>{action.emoji}</ThemedText>
          <ThemedText style={styles.label}>{action.label}</ThemedText>
          {action.detail && (
            <ThemedText type="small" themeColor="textSecondary">
              {action.detail}
            </ThemedText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: {
    // Two per row, gap accounted for; a lone last item stretches full width.
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28, lineHeight: 36 },
  label: { fontWeight: 600 },
});
