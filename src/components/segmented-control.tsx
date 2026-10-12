import { Pressable, StyleSheet } from 'react-native';

import { Glass } from '@/components/glass';
import { ThemedText } from '@/components/themed-text';
import { InkOnWhite, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  /** null shows no segment selected (e.g. a choice not made yet). */
  value: T | null;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <Glass radius={28} blur={false} flat style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) tapFeedback();
              onChange(option.value);
            }}
            style={[styles.segment, selected && styles.selected]}>
            <ThemedText style={[styles.label, { color: selected ? InkOnWhite : theme.text }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.one,
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: '#FFFFFF' },
  label: { fontWeight: 600 },
});
