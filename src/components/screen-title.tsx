import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';

/**
 * The big serif heading at the top of each tab (Home, Oracle, Insights, Settings), so they all
 * share one size and alignment. An optional line underneath says what the screen shows.
 */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <ThemedText style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
      {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.half },
  title: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 42, fontWeight: 400 },
});
