import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { parseInvite, type Invite } from '@/sync/pairing';
import { useSync } from '@/sync/sync-provider';

/** Scans another phone's family code and joins its family. */
export default function JoinScreen() {
  const db = useSQLiteContext();
  const sync = useSync();
  const [permission, requestPermission] = useCameraPermissions();
  // The scanner reports the same code many times a second; handle it once.
  const handling = useRef(false);

  const confirmJoin = async (invite: Invite) => {
    const local = await db.getFirstAsync<{ id: string; name: string }>(
      'SELECT id, name FROM child ORDER BY created_at LIMIT 1',
    );
    const count = local
      ? ((
          await db.getFirstAsync<{ n: number }>(
            'SELECT count(*) AS n FROM event WHERE child_id = ? AND deleted_at IS NULL',
            local.id,
          )
        )?.n ?? 0)
      : 0;
    const merging =
      local && local.id !== invite.childId && count > 0
        ? `\n\nThe ${count} ${count === 1 ? 'entry' : 'entries'} already on this phone will be added to ${invite.childName}'s shared log.`
        : '';

    Alert.alert(
      `Join ${invite.childName}'s family?`,
      `This phone will share ${invite.childName}'s log with the family's other phones over your Wi-Fi.${merging}`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => (handling.current = false) },
        {
          text: 'Join',
          onPress: async () => {
            try {
              await sync.join(invite);
              // Go to the sync status. (From the welcome screen there's nothing to go back
              // to: joining creates the profile, which replaces the welcome screen.)
              router.replace('/settings');
            } catch (error) {
              handling.current = false;
              Alert.alert('Couldn’t join', (error as Error).message);
            }
          },
        },
      ],
    );
  };

  const onScanned = ({ data }: { data: string }) => {
    if (handling.current) return;
    handling.current = true;
    try {
      void confirmJoin(parseInvite(data));
    } catch (error) {
      Alert.alert('Not a family code', (error as Error).message, [
        { text: 'OK', onPress: () => (handling.current = false) },
      ]);
    }
  };

  if (!sync.supported) {
    return (
      <Screen withTabBar={false} belowHeader>
        <ThemedText>
          Family sync works in the installed app. Expo Go (the development preview) can&apos;t use
          the local network.
        </ThemedText>
      </Screen>
    );
  }

  if (!permission?.granted) {
    return (
      <Screen withTabBar={false} belowHeader>
        <ThemedText>
          LibreBaby needs the camera to scan the family code shown on the other phone. The camera is
          only used here.
        </ThemedText>
        <Button title="Allow camera" onPress={() => void requestPermission()} />
      </Screen>
    );
  }

  return (
    <Screen withTabBar={false} belowHeader>
      <ThemedText>
        On the other phone, go to Settings → Family sync → Show family code, and point this camera
        at it.
      </ThemedText>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: {
    height: 320,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
});
