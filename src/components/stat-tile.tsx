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
  /** The icon's color; the theme accent if not given. */
  iconColor?: string;
  /** How many lines the detail may take before it's cut off (2 unless a tile needs more). */
  detailLines?: number;
};

/** A small glass tile: icon and label on top, the value below. Laid out in rows of three. */
export function StatTile({
  icon,
  title,
  value,
  detail,
  iconColor,
  detailLines = 2,
}: StatTileProps) {
  const theme = useTheme();
  return (
    <Glass radius={24} style={styles.tile}>
      <View style={styles.top}>
        <Icon name={icon} size={16} color={iconColor ?? theme.accent} />
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
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={detailLines}
          style={styles.detail}>
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
  title: { flexShrink: 1, fontSize: 14, lineHeight: 18 },
  value: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
  detail: { fontSize: 14, lineHeight: 18 },
});
