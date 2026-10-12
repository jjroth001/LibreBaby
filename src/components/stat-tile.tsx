import { StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatTileProps = {
  icon: IconName;
  title: string;
  value?: string | null;
  detail?: string;
};

/** A small glass tile: icon and label on top, the value below. Laid out in rows of three. */
export function StatTile({ icon, title, value, detail }: StatTileProps) {
  const theme = useTheme();
  return (
    <Glass radius={24} style={styles.tile}>
      <View style={styles.top}>
        <Icon name={icon} size={16} color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
      </View>
      <ThemedText
        style={styles.value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}>
        {value ?? '—'}
      </ThemedText>
      {detail ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.detail}>
          {detail}
        </ThemedText>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three - 2,
    gap: Spacing.one,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  title: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
  value: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  detail: { fontSize: 12, lineHeight: 16 },
});
