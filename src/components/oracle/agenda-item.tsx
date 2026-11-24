import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Confidence, OracleItem } from '@/lib/oracle';

import {
  categoryColor,
  itemIcon,
  itemLabel,
  itemName,
  itemSubtitle,
  itemTime,
} from './oracle-style';

/** "Likely" is a solid pill; "Maybe" an outline, like a tentative calendar event. */
export function ConfidenceTag({ confidence }: { confidence: Confidence }) {
  const theme = useTheme();
  const likely = confidence === 'likely';
  return (
    <View
      style={[
        styles.tag,
        likely
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { borderColor: theme.textSecondary },
      ]}>
      <ThemedText
        style={[
          styles.tagText,
          { color: likely ? (theme.light ? '#FFFFFF' : '#1B1E3D') : theme.textSecondary },
        ]}>
        {likely ? 'Likely' : 'Maybe'}
      </ThemedText>
    </View>
  );
}

/**
 * One estimate on the agenda: a colored block, solid if likely, dashed if only maybe. The
 * time has a column of its own (as on the Timeline), so the name never wraps away from it.
 */
export function AgendaItem({ item, onPress }: { item: OracleItem; onPress: () => void }) {
  const theme = useTheme();
  const { bar, fill } = categoryColor(theme, item);
  const likely = item.confidence === 'likely';
  const subtitle = itemSubtitle(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={itemLabel(item)}
      accessibilityHint="Shows why"
      onPress={onPress}
      style={({ pressed }) => [
        styles.block,
        likely
          ? { backgroundColor: fill, borderColor: 'transparent' }
          : { borderColor: bar, borderStyle: 'dashed' },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.bar, { backgroundColor: bar }]} />
      <ThemedText type="smallBold" style={styles.time}>
        {itemTime(item)}
      </ThemedText>
      <Icon name={itemIcon(item)} size={22} color={bar} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title} numberOfLines={2}>
            {itemName(item)}
          </ThemedText>
          <ConfidenceTag confidence={item.confidence} />
        </View>
        {subtitle && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    minHeight: 52,
    paddingVertical: Spacing.two + Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two + Spacing.one,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: Spacing.two,
    bottom: Spacing.two,
    width: 4,
    borderRadius: 2,
  },
  // Fits "~10:45 PM" at the default text size.
  time: { width: 76 },
  body: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: 600 },
  tag: {
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  tagText: { fontSize: 12, lineHeight: 17, fontWeight: 700 },
});
