import { StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icons/icon';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/format';
import { remindersSupported } from '@/lib/notifications';

const HOUR = 3_600_000;

export type RemindChoice = { on: boolean; hours: number; custom: boolean };

const PRESETS = [4, 6, 8];
type Option = '4' | '6' | '8' | 'other';
const OPTIONS: readonly { value: Option; label: string }[] = [
  { value: '4', label: '4 h' },
  { value: '6', label: '6 h' },
  { value: '8', label: '8 h' },
  { value: 'other', label: 'Other' },
];

export function choiceFor(hours: number, on: boolean): RemindChoice {
  return { on, hours, custom: !PRESETS.includes(hours) };
}

type RemindNextDoseProps = {
  value: RemindChoice;
  onChange: (value: RemindChoice) => void;
  /** When the dose being logged was given. */
  givenAt: number;
  /** A daily reminder already set for this medicine, e.g. "Every day at 8:00 AM". */
  dailyNote?: string;
};

/** "Remind me for the next dose" on the medication log: a switch and how many hours. */
export function RemindNextDose({ value, onChange, givenAt, dailyNote }: RemindNextDoseProps) {
  const theme = useTheme();
  const on = remindersSupported && value.on;
  const selected: Option = value.custom ? 'other' : (String(value.hours) as Option);

  return (
    <Animated.View
      layout={Motion.layout}
      style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        <Icon name="bell" size={20} color={theme.accent} />
        <View style={styles.label}>
          <ThemedText type="smallBold">Remind me for the next dose</ThemedText>
          {!remindersSupported && (
            <ThemedText type="small" themeColor="textSecondary">
              Available in the installed app. Expo Go (the development preview) can’t show these
              notifications.
            </ThemedText>
          )}
        </View>
        <Switch
          disabled={!remindersSupported}
          value={on}
          onValueChange={(next) => onChange({ ...value, on: next })}
          trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Remind me for the next dose"
        />
      </View>

      {on && (
        <Animated.View
          entering={Motion.enter}
          exiting={Motion.exit}
          layout={Motion.layout}
          style={styles.details}>
          <SegmentedControl
            options={OPTIONS}
            value={selected}
            onChange={(option) =>
              onChange(
                option === 'other'
                  ? { ...value, custom: true }
                  : { ...value, hours: Number(option), custom: false },
              )
            }
          />
          {value.custom && (
            <Animated.View entering={Motion.enter} exiting={Motion.exit} layout={Motion.layout}>
              <Stepper
                value={value.hours}
                onChange={(hours) => onChange({ ...value, hours: Math.min(72, hours) })}
                step={1}
                min={1}
                suffix="h"
                integer
                size="medium"
                accessibilityName="hours until the reminder"
              />
            </Animated.View>
          )}
          <Animated.View layout={Motion.layout}>
            <ThemedText type="small" themeColor="textSecondary">
              Reminder at about {formatTime(givenAt + value.hours * HOUR)}. Logging another dose
              moves it.
            </ThemedText>
          </Animated.View>
        </Animated.View>
      )}

      {dailyNote && (
        <Animated.View layout={Motion.layout}>
          <ThemedText type="small" themeColor="textSecondary">
            Also set: {dailyNote.charAt(0).toLowerCase() + dailyNote.slice(1)}.
          </ThemedText>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 20, padding: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1, gap: Spacing.half },
  details: { gap: Spacing.three },
});
