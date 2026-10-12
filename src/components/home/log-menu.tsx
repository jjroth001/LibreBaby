import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { ActionGrid, type Action } from '@/components/home/action-grid';
import { Icon, type IconName } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { InkOnWhite, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Category = 'sleep' | 'feed' | 'diaper' | 'meds';

const CATEGORIES: { key: Category; icon: IconName; label: string }[] = [
  { key: 'sleep', icon: 'moon-stars', label: 'Sleep' },
  { key: 'feed', icon: 'bottle', label: 'Feed' },
  { key: 'diaper', icon: 'diaper', label: 'Diaper' },
  { key: 'meds', icon: 'pill', label: 'Meds' },
];

const SIZE = 68;

type LogMenuProps = {
  open: Category | null;
  onToggle: (category: Category) => void;
  /** Called after any option is chosen, so Home is tidy again afterwards. */
  onClose: () => void;
  actions: Record<Category, Action[]>;
};

/** Round glass category buttons; the open one turns white and reveals its options below. */
export function LogMenu({ open, onToggle, onClose, actions }: LogMenuProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {CATEGORIES.map((category) => {
          const selected = open === category.key;
          return (
            <Pressable
              key={category.key}
              accessibilityRole="button"
              accessibilityLabel={category.label}
              accessibilityState={{ expanded: selected }}
              onPress={() => onToggle(category.key)}
              style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
              {selected ? (
                <View style={[styles.circle, styles.selected]}>
                  <Icon name={category.icon} size={30} color={InkOnWhite} />
                </View>
              ) : (
                <Glass radius={SIZE / 2} style={styles.circle}>
                  <Icon name={category.icon} size={30} color={theme.text} />
                </Glass>
              )}
              <ThemedText style={styles.label}>{category.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Keyed by category so switching submenus replays the slide-in. */}
      {open && (
        <Animated.View key={open} entering={Motion.enter}>
          <ActionGrid
            actions={actions[open].map((action) => ({
              ...action,
              onPress: () => {
                onClose();
                action.onPress();
              },
            }))}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  slot: {
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: SIZE + Spacing.two,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderRadius: SIZE / 2,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 6px 18px rgba(0,0,0,0.18)',
  },
  label: { fontSize: 14, lineHeight: 18, fontWeight: 600 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
