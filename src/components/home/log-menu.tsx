import { Pressable, StyleSheet, View } from 'react-native';

import { ActionGrid, type Action } from '@/components/home/action-grid';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Category = 'sleep' | 'feed' | 'diaper';

const CATEGORIES: { key: Category; emoji: string; label: string }[] = [
  { key: 'sleep', emoji: '😴', label: 'Sleep' },
  { key: 'feed', emoji: '🍼', label: 'Feed' },
  { key: 'diaper', emoji: '🧷', label: 'Diaper' },
];

type LogMenuProps = {
  open: Category | null;
  onToggle: (category: Category) => void;
  /** Called after any option is chosen, so Home is tidy again afterwards. */
  onClose: () => void;
  actions: Record<Category, Action[]>;
};

/** Three category buttons; the open one reveals its options right underneath. */
export function LogMenu({ open, onToggle, onClose, actions }: LogMenuProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {CATEGORIES.map((category) => {
          const selected = open === category.key;
          return (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              accessibilityState={{ expanded: selected }}
              onPress={() => onToggle(category.key)}
              style={({ pressed }) => [
                styles.category,
                { backgroundColor: selected ? theme.tint : theme.backgroundElement },
                pressed && !selected && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText style={styles.emoji}>{category.emoji}</ThemedText>
              <ThemedText style={[styles.label, { color: selected ? theme.onTint : theme.text }]}>
                {category.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {open && (
        <ActionGrid
          actions={actions[open].map((action) => ({
            ...action,
            onPress: () => {
              onClose();
              action.onPress();
            },
          }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  category: {
    flex: 1,
    minHeight: 104,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  emoji: { fontSize: 32, lineHeight: 40 },
  label: { fontSize: 18, fontWeight: 700 },
});
