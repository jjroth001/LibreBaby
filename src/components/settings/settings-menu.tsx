import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

export type MenuItem = {
  icon: IconName;
  title: string;
  /** What's set now, in a few words. */
  summary: string;
  href: Href;
};

/** A labelled glass panel of Settings rows, each opening its own page. */
export function MenuGroup({ label, items }: { label: string; items: MenuItem[] }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText
        type="smallBold"
        themeColor="textSecondary"
        style={styles.label}
        accessibilityRole="header">
        {label.toUpperCase()}
      </ThemedText>
      <Glass radius={24} style={styles.panel}>
        {items.map((item, index) => (
          <Fragment key={item.title}>
            {index > 0 && (
              <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
            )}
            <MenuRow item={item} />
          </Fragment>
        ))}
      </Glass>
    </View>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.summary}`}
      onPress={() => {
        tapFeedback();
        router.push(item.href);
      }}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <Icon name={item.icon} size={24} color={theme.accent} />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.title}
        </ThemedText>
        {item.summary !== '' && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {item.summary}
          </ThemedText>
        )}
      </View>
      <Icon name="caret-right" size={18} color={theme.textSecondary} duotone={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  label: { marginLeft: Spacing.one, letterSpacing: 1 },
  // Clips each row's pressed highlight to the panel's rounded corners.
  panel: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingVertical: Spacing.three,
    minHeight: 64,
  },
  text: { flex: 1, gap: 2 },
  // Inset to line up with the text, past the icon.
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 56 + Spacing.one },
});
