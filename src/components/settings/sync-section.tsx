import { BackgroundSync } from '@modules/background-sync/src';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, AppState, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { SubmitButton } from '@/components/forms/submit-button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Child } from '@/db/types';
import { setSetting } from '@/db/settings';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { useSync } from '@/sync/sync-provider';

type Peer = { device_id: string; name: string; last_synced_at: number | null };

const isUnrestricted = () => BackgroundSync?.isIgnoringBatteryOptimizations() ?? true;

/** Settings → Family sync: set up, pair phones, see status, stop syncing. */
export function SyncSection({ child }: { child: Child }) {
  const theme = useTheme();
  const sync = useSync();
  const now = useNow(30_000);
  const db = useSQLiteContext();
  const { data: settings } = useSettings();
  const [unrestricted, setUnrestricted] = useState(isUnrestricted);
  // Re-check when coming back from Android's prompt.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setUnrestricted(isUnrestricted());
    });
    return () => subscription.remove();
  }, []);
  const peers = useDbQuery(['sync_peer'], (db) =>
    db.getAllAsync<Peer>('SELECT device_id, name, last_synced_at FROM sync_peer ORDER BY name'),
  );

  if (sync.family === undefined) return null;

  const leave = () =>
    Alert.alert(
      'Stop syncing on this phone?',
      `${child.name}'s log stays on this phone, but it won't share changes with the family anymore. You can join again later with the family code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop syncing', style: 'destructive', onPress: () => void sync.leave() },
      ],
    );

  const resetCode = () =>
    Alert.alert(
      'Reset the family code?',
      `Phones with the old code will stop syncing with this one. Do this if a phone was lost or sold, or someone shouldn't see ${child.name}'s log anymore. Then scan the new code on each phone you want to keep.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset code',
          style: 'destructive',
          onPress: async () => {
            await sync.resetCode();
            router.push('/sync/pair');
          },
        },
      ],
    );

  const status = sync.syncing
    ? 'Syncing…'
    : sync.lastEvent?.type === 'error'
      ? `Last attempt failed: ${sync.lastEvent.message}`
      : sync.lastEvent?.type === 'synced'
        ? `Synced with ${sync.lastEvent.peerName}`
        : 'Looking for family phones on this Wi-Fi…';

  return (
    <Card>
      {!sync.supported ? (
        <ThemedText type="small" themeColor="textSecondary">
          Available in the installed app. Expo Go (the development preview) can&apos;t use the local
          network.
        </ThemedText>
      ) : !sync.family ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Share {child.name}&apos;s log with your family&apos;s phones over your home Wi-Fi. No
            accounts and no cloud: phones sync directly whenever they&apos;re on the same Wi-Fi with
            LibreBaby open.
          </ThemedText>
          <SubmitButton
            title="Set up family sync"
            busyTitle="Setting up…"
            onPress={async () => {
              await sync.setUp();
              router.push('/sync/pair');
            }}
          />
          <Button
            title="Join with a family code"
            variant="secondary"
            onPress={() => router.push('/sync/join')}
          />
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
          {(peers.data ?? []).map((peer) => (
            <View key={peer.device_id} style={styles.peer}>
              <Icon name="wifi-high" size={18} color={theme.accent} />
              <ThemedText type="small" style={styles.peerText}>
                {peer.name}
                {peer.last_synced_at
                  ? ` — synced ${formatDuration(now - peer.last_synced_at)} ago`
                  : ''}
              </ThemedText>
            </View>
          ))}
          {(peers.data ?? []).length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              No other phones yet. Show the family code on this phone and scan it on the other.
            </ThemedText>
          )}
          {BackgroundSync && settings && (
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <ThemedText type="smallBold">Keep syncing when the app is closed</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Shows a quiet “Family sync is on” notification while it runs. Turn off to sync
                  only while LibreBaby is open.
                </ThemedText>
              </View>
              <Switch
                value={settings.backgroundSync}
                onValueChange={(on) => setSetting(db, 'backgroundSync', on)}
                trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}
          {BackgroundSync && settings?.backgroundSync && !unrestricted && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Android may pause background sync while the phone sleeps. Allowing LibreBaby to run
                unrestricted keeps it reliable.
              </ThemedText>
              <Button
                title="Allow background activity"
                variant="secondary"
                onPress={() => BackgroundSync?.requestIgnoreBatteryOptimizations()}
              />
            </>
          )}
          <Button title="Sync now" onPress={sync.syncNow} />
          <Button
            title="Show family code"
            variant="secondary"
            onPress={() => router.push('/sync/pair')}
          />
          <Button title="Reset family code" variant="secondary" onPress={resetCode} />
          <Button title="Stop syncing on this phone" variant="secondary" onPress={leave} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  switchLabel: { flex: 1, gap: Spacing.half },
  peer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  peerText: { flexShrink: 1 },
});
