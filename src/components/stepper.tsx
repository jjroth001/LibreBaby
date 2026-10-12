import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  /** What to show between the buttons, e.g. "4 oz" or "12 min". */
  display: string;
  /** Spoken name of the quantity, e.g. "amount" or "left side minutes". */
  accessibilityName: string;
  size?: 'large' | 'medium';
};

/** − value + control with big touch targets. */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  display,
  accessibilityName,
  size = 'large',
}: StepperProps) {
  const theme = useTheme();
  const large = size === 'large';

  const change = (direction: 1 | -1) => {
    tapFeedback();
    onChange(Math.max(min, Math.round((value + direction * step) * 10) / 10));
  };

  const button = [
    styles.button,
    large ? styles.buttonLarge : styles.buttonMedium,
    { backgroundColor: theme.backgroundElement },
  ];

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${accessibilityName}`}
        onPress={() => change(-1)}
        style={button}>
        <ThemedText style={styles.sign}>−</ThemedText>
      </Pressable>
      <ThemedText style={large ? styles.valueLarge : styles.valueMedium}>{display}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${accessibilityName}`}
        onPress={() => change(1)}
        style={button}>
        <ThemedText style={styles.sign}>+</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  button: { alignItems: 'center', justifyContent: 'center' },
  buttonLarge: { width: 64, height: 64, borderRadius: 32 },
  buttonMedium: { width: 56, height: 56, borderRadius: 28 },
  sign: { fontSize: 32, lineHeight: 36, fontWeight: 600 },
  valueLarge: { fontSize: 44, lineHeight: 52, fontWeight: 700, fontVariant: ['tabular-nums'] },
  valueMedium: { fontSize: 28, lineHeight: 34, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
