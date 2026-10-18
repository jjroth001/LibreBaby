import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { setSetting, type Settings } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';

type Toggle = {
  key: 'highContrast' | 'reduceMotion' | 'haptics';
  title: string;
  detail: string;
};

const TOGGLES: Toggle[] = [
  {
    key: 'highContrast',
    title: 'Increase contrast',
    detail: 'More solid panels and stronger secondary text.',
  },
  {
    key: 'reduceMotion',
    title: 'Reduce motion',
    detail: 'Turn off animations. They also stop when Android’s “Remove animations” is on.',
  },
  {
    key: 'haptics',
    title: 'Vibration',
    detail: 'A small tap when you log something or start a timer.',
  },
];

export function AccessibilitySection({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const theme = useTheme();

  return (
    <Card>
      {TOGGLES.map((toggle) => (
        <View key={toggle.key} style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="smallBold">{toggle.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {toggle.detail}
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel={toggle.title}
            value={settings[toggle.key]}
            onValueChange={(on) => setSetting(db, toggle.key, on)}
            trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
            thumbColor="#FFFFFF"
          />
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Text size follows Android’s font size setting, and buttons are labelled for screen readers
        like TalkBack.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchLabel: { flex: 1, gap: Spacing.half },
});
