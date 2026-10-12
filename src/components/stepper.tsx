import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  /** Unit shown after the number, e.g. "oz" or "min". */
  suffix: string;
  /** Whole numbers only (minutes); otherwise up to 2 decimals (amounts like 1.25 oz). */
  integer?: boolean;
  /** Spoken name of the quantity, e.g. "amount" or "left side minutes". */
  accessibilityName: string;
  size?: 'large' | 'medium';
};

/** Rounds away float noise (0.1 + 0.2) while keeping quarter steps like 1.25. */
function clean(value: number, integer: boolean): number {
  return integer ? Math.round(value) : Math.round(value * 100) / 100;
}

/** − value + control with big touch targets. Tap the number to type an exact value. */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  suffix,
  integer = false,
  accessibilityName,
  size = 'large',
}: StepperProps) {
  const theme = useTheme();
  const large = size === 'large';
  const [draft, setDraft] = useState<string | null>(null);

  const change = (direction: 1 | -1) => {
    tapFeedback();
    onChange(Math.max(min, clean(value + direction * step, integer)));
  };

  const commitDraft = () => {
    if (draft === null) return;
    // Accept a comma as the decimal separator too.
    const parsed = Number.parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(parsed)) onChange(Math.max(min, clean(parsed, integer)));
    setDraft(null);
  };

  const button = [
    styles.button,
    large ? styles.buttonLarge : styles.buttonMedium,
    { backgroundColor: theme.backgroundElement },
  ];
  const valueStyle = large ? styles.valueLarge : styles.valueMedium;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${accessibilityName}`}
        onPress={() => change(-1)}
        style={button}>
        <ThemedText style={styles.sign}>−</ThemedText>
      </Pressable>

      {draft === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityName}: ${value} ${suffix}`}
          accessibilityHint="Tap to type a value"
          onPress={() => setDraft(String(value))}
          style={[styles.value, { borderBottomColor: theme.backgroundSelected }]}>
          <ThemedText style={valueStyle}>
            {value} {suffix}
          </ThemedText>
        </Pressable>
      ) : (
        <View style={[styles.value, styles.editing, { borderBottomColor: theme.tint }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            autoFocus
            selectTextOnFocus
            keyboardType={integer ? 'number-pad' : 'decimal-pad'}
            returnKeyType="done"
            accessibilityLabel={`${accessibilityName} in ${suffix}`}
            style={[valueStyle, styles.input, { color: theme.text }]}
          />
          <ThemedText style={valueStyle}>{suffix}</ThemedText>
        </View>
      )}

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  button: { alignItems: 'center', justifyContent: 'center' },
  buttonLarge: { width: 64, height: 64, borderRadius: 32 },
  buttonMedium: { width: 56, height: 56, borderRadius: 28 },
  sign: { fontSize: 32, lineHeight: 36, fontWeight: 600 },
  // A subtle underline hints that the number can be tapped and typed.
  value: {
    flexShrink: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingHorizontal: Spacing.two,
  },
  editing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  input: { minWidth: 48, textAlign: 'right', padding: 0 },
  valueLarge: { fontSize: 44, lineHeight: 52, fontWeight: 700, fontVariant: ['tabular-nums'] },
  valueMedium: { fontSize: 28, lineHeight: 34, fontWeight: 700, fontVariant: ['tabular-nums'] },
});
