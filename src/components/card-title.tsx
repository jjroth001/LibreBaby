import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A card's heading: an accent-colored icon and a short bold label. */
export function CardTitle({ icon, children }: { icon: IconName; children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      <Icon name={icon} size={20} color={theme.accent} />
      <ThemedText type="smallBold" style={styles.text}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { flexShrink: 1 },
});
