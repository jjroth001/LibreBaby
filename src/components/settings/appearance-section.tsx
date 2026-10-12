import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { CardTitle } from '@/components/card-title';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { setSetting, type Settings } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/format';
import { requestSkyLocation } from '@/lib/location';
import { sunTimes } from '@/lib/sun';

const APPEARANCE_OPTIONS = [
  { value: 'sky', label: 'Time of day' },
  { value: 'night', label: 'Always night' },
] as const;

function todaysSun(location: NonNullable<Settings['skyLocation']>) {
  const d = new Date();
  const times = sunTimes(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    location.lat,
    location.lon,
  );
  if (times.kind === 'normal') {
    return `Today: sunrise ${formatTime(times.sunrise)}, sunset ${formatTime(times.sunset)}.`;
  }
  return times.kind === 'always-up' ? 'The sun doesn’t set today.' : 'The sun doesn’t rise today.';
}

export function AppearanceSection({ settings }: { settings: Settings }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [locating, setLocating] = useState(false);
  const location = settings.skyLocation;

  const toggleLocation = async (on: boolean) => {
    if (!on) {
      await setSetting(db, 'skyLocation', null);
      return;
    }
    setLocating(true);
    try {
      const found = await requestSkyLocation();
      if (found) await setSetting(db, 'skyLocation', found);
      else
        Alert.alert(
          'Location not available',
          'Allow approximate location for this app in Android Settings, or keep the typical sunrise and sunset times.',
        );
    } catch {
      Alert.alert('Location not available', 'Couldn’t get a location right now. Try again later.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Card>
      <CardTitle icon="sun-horizon">Appearance</CardTitle>
      <SegmentedControl
        options={APPEARANCE_OPTIONS}
        value={settings.appearance}
        onChange={(appearance) => setSetting(db, 'appearance', appearance)}
      />
      {settings.appearance === 'sky' && (
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="smallBold">Use my location for sunrise and sunset</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {location
                ? `${todaysSun(location)} Your location is rounded to about 10 km and never leaves this phone.`
                : 'Otherwise the sky uses typical times (sunrise 6:30 AM, sunset 7 PM). Your location is rounded to about 10 km and never leaves this phone.'}
            </ThemedText>
          </View>
          <Switch
            disabled={locating}
            value={location != null}
            onValueChange={toggleLocation}
            trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
            thumbColor="#FFFFFF"
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchLabel: { flex: 1, gap: Spacing.half },
});
