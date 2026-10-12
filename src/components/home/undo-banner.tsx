import { useEffect, useEffectEvent } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const VISIBLE_MS = 5000;

type UndoBannerProps = {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
};

/** Snackbar confirming a one-tap log, with a short window to undo it. Re-key it to restart the timer. */
export function UndoBanner({ message, onUndo, onDismiss }: UndoBannerProps) {
  const theme = useTheme();

  // The parent re-renders every second (running timers), so don't restart the countdown
  // when `onDismiss` changes identity — only when the banner is re-keyed.
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const id = setTimeout(() => dismiss(), VISIBLE_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <Animated.View entering={Motion.rise} exiting={Motion.sink} style={styles.position}>
      <Pressable
        onPress={onDismiss}
        style={[styles.banner, { backgroundColor: theme.text }]}
        accessibilityLiveRegion="polite">
        <ThemedText style={[styles.message, { color: theme.background }]}>{message}</ThemedText>
        <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={12}>
          <ThemedText style={[styles.undo, { color: theme.tint }]}>UNDO</ThemedText>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
  },
  banner: {
    minHeight: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  message: { flex: 1 },
  undo: { fontWeight: 700 },
});
