import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <ThemedView type="backgroundElement" style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
});
