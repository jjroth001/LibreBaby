import { StyleSheet, type ViewProps } from 'react-native';

import { Glass } from '@/components/glass';
import { Spacing } from '@/constants/theme';

/** A content panel: liquid glass over the sky. */
export function Card({ style, blur, ...rest }: ViewProps & { blur?: boolean }) {
  return <Glass radius={28} blur={blur} style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three + Spacing.one,
    gap: Spacing.three,
  },
});
