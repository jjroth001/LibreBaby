import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatTime } from '@/lib/format';
import type { OracleItem } from '@/lib/oracle';

import { ConfidenceTag } from './agenda-item';
import { categoryColor, itemIcon, itemName, windowText } from './oracle-style';

type WhySheetProps = {
  /** Kept while the sheet fades out, so it doesn't go blank on the way out. */
  item: OracleItem | null;
  visible: boolean;
  onClose: () => void;
};

/** Where the best guess sits in its window: the window as a band, the guess as a dot. */
function SpreadBar({ item, bar, fill }: { item: OracleItem; bar: string; fill: string }) {
  const theme = useTheme();
  const pad = Math.max((item.to - item.from) * 0.25, 5 * 60_000);
  const start = item.from - pad;
  const span = item.to + pad - start;
  const pct = (ms: number) => `${((ms - start) / span) * 100}%` as const;
  const width = `${((item.to - item.from) / span) * 100}%` as const;

  return (
    <View accessible={false}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.band, { left: pct(item.from), width, backgroundColor: fill }]} />
        <View
          style={[
            styles.dot,
            { left: pct(item.at), backgroundColor: bar, borderColor: theme.surface },
          ]}
        />
      </View>
      <View style={styles.ticks}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTime(item.from)}
        </ThemedText>
        <ThemedText type="smallBold">{formatTime(item.at)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTime(item.to)}
        </ThemedText>
      </View>
    </View>
  );
}

/** Tap an agenda item: its window, and in plain words why the Oracle expects it then. */
export function WhySheet({ item, visible, onClose }: WhySheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!item) return null;
  const { bar, fill } = categoryColor(theme, item);
  const solidFill = theme.light ? fill : fill.replace(/[\d.]+\)$/, '0.32)');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <Animated.View
        entering={SlideInDown.duration(260)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.simple ? theme.card : theme.surface,
            paddingBottom: insets.bottom + Spacing.four,
          },
        ]}>
        <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />

        <View style={styles.head}>
          <View style={[styles.iconCircle, { backgroundColor: solidFill }]}>
            <Icon name={itemIcon(item)} size={24} color={bar} />
          </View>
          <View style={styles.headText}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {itemName(item)}
            </ThemedText>
            <ThemedText style={styles.when} accessibilityRole="header">
              {item.due ? 'Due now' : `Around ${formatTime(item.at)}`}
            </ThemedText>
          </View>
          <ConfidenceTag confidence={item.confidence} />
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Probably between {windowText(item)}
          {item.endAt != null ? ` · lasts about ${formatDuration(item.endAt - item.at)}` : ''}
        </ThemedText>
        <SpreadBar item={item} bar={bar} fill={solidFill} />

        <View style={styles.why}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
            WHY THIS TIME
          </ThemedText>
          {item.reasons.map((reason) => (
            <View key={reason} style={styles.reason}>
              <View style={[styles.bullet, { backgroundColor: bar }]} />
              <ThemedText type="small" style={styles.reasonText}>
                {reason}
              </ThemedText>
            </View>
          ))}
          {item.confidence === 'maybe' && (
            <View style={styles.reason}>
              <View style={[styles.bullet, { backgroundColor: bar }]} />
              <ThemedText type="small" style={styles.reasonText}>
                Marked “maybe”: the pattern varies, there isn’t much history yet, or it depends on
                earlier guesses.
              </ThemedText>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: theme.tint },
            pressed && { opacity: 0.8 },
          ]}>
          <ThemedText style={[styles.closeText, { color: theme.onTint }]}>Done</ThemedText>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,10,25,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1 },
  when: { fontSize: 24, lineHeight: 30, fontWeight: 600 },
  track: { height: 8, borderRadius: 4, marginTop: Spacing.two },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 4 },
  dot: {
    position: 'absolute',
    top: -5,
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    borderWidth: 3,
  },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two },
  why: { gap: Spacing.two },
  caps: { letterSpacing: 0.6, fontSize: 12 },
  reason: { flexDirection: 'row', gap: Spacing.two + Spacing.one },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  reasonText: { flex: 1 },
  close: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  closeText: { fontSize: 16, fontWeight: 600 },
});
