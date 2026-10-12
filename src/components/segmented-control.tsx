import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
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
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
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
            style={[styles.segment, selected && { backgroundColor: theme.tint }]}>
            <ThemedText style={[styles.label, { color: selected ? theme.onTint : theme.text }]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: Spacing.three - Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontWeight: 600 },
});
