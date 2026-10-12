import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TextField({ label, style, ...rest }: TextInputProps & { label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  input: {
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 18,
  },
});
