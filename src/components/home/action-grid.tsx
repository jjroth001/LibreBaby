import { Pressable, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { InkOnWhite, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Action = {
  key: string;
  icon: IconName;
  label: string;
  detail?: string;
  /** A pill with room for a longer label and detail; otherwise a round button. */
  wide?: boolean;
  /** The main thing to do here: solid white. */
  primary?: boolean;
  onPress: () => void;
};

const ROUND = 56;
const INK_MUTED = 'rgba(27,30,61,0.7)';

function accessibilityLabel(action: Action) {
  return action.detail ? `${action.label}, ${action.detail}` : action.label;
}

/**
 * A glass sheet of options: wide pills first (two per row), then round buttons with the
 * label underneath (four per row) — big, thumb-friendly targets either way.
 */
export function ActionGrid({ actions }: { actions: Action[] }) {
  const theme = useTheme();
  const wide = actions.filter((a) => a.wide);
  const round = actions.filter((a) => !a.wide);

  return (
    <Glass radius={30} style={styles.sheet}>
      {wide.length > 0 && (
        <View style={styles.pills}>
          {wide.map((action) => {
            const ink = action.primary ? InkOnWhite : theme.text;
            const content = (
              <>
                <Icon name={action.icon} size={22} color={ink} />
                <View style={styles.pillText}>
                  <ThemedText style={[styles.pillLabel, { color: ink }]} numberOfLines={1}>
                    {action.label}
                  </ThemedText>
                  {action.detail && (
                    <ThemedText
                      numberOfLines={1}
                      style={[
                        styles.pillDetail,
                        {
                          color: action.primary ? INK_MUTED : theme.textSecondary,
                        },
                      ]}>
                      {action.detail}
                    </ThemedText>
                  )}
                </View>
              </>
            );
            return (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel(action)}
                onPress={action.onPress}
                style={({ pressed }) => [styles.pillSlot, pressed && styles.pressed]}>
                {action.primary ? (
                  <View style={[styles.pill, styles.primary]}>{content}</View>
                ) : (
                  <Glass radius={28} flat style={styles.pill}>
                    {content}
                  </Glass>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      {round.length > 0 && (
        <View style={styles.rounds}>
          {round.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel(action)}
              onPress={action.onPress}
              style={({ pressed }) => [styles.roundSlot, pressed && styles.pressed]}>
              {action.primary ? (
                <View style={[styles.round, styles.primary, styles.roundShape]}>
                  <Icon name={action.icon} size={26} color={InkOnWhite} />
                </View>
              ) : (
                <Glass radius={ROUND / 2} flat style={styles.round}>
                  <Icon name={action.icon} size={26} color={theme.text} />
                </Glass>
              )}
              <ThemedText style={styles.roundLabel} numberOfLines={2}>
                {action.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: Spacing.three, gap: Spacing.three },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Two per row; a lone last pill stretches across.
  pillSlot: { flexBasis: '45%', flexGrow: 1 },
  pill: {
    minHeight: 56,
    borderRadius: 28,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  primary: { backgroundColor: '#FFFFFF' },
  pillText: { flexShrink: 1 },
  pillLabel: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  pillDetail: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
  rounds: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.three },
  roundSlot: { width: '25%', alignItems: 'center', gap: Spacing.one + 2 },
  round: {
    width: ROUND,
    height: ROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundShape: { borderRadius: ROUND / 2 },
  roundLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 500,
    textAlign: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
