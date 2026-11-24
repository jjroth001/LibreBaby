import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  /**
   * `danger` is a solid red button for erasing everything; `delete` is a quiet button with red
   * text for removing one thing (an entry, a reminder), so it doesn't shout but isn't missed.
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'delete';
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const filled = variant === 'primary' || variant === 'danger';
  const background =
    variant === 'danger'
      ? theme.danger
      : variant === 'primary'
        ? theme.tint
        : theme.backgroundSelected;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}>
      <ThemedText
        style={[
          styles.label,
          { color: filled ? theme.onTint : variant === 'delete' ? theme.danger : theme.text },
        ]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: 600,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
