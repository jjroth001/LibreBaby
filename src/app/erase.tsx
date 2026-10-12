import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { SubmitButton } from '@/components/forms/submit-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { countEntries, eraseAllData } from '@/db/erase';
import { setSetting } from '@/db/settings';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { shareBackup } from '@/lib/data-transfer';
import { syncSleepReminder } from '@/lib/notifications';
import { useSync } from '@/sync/sync-provider';

const CONFIRM_WORD = 'DELETE';

/**
 * "Start over": wipes the profile, every entry and all settings. Typing DELETE is
 * required so it can't happen by an accidental tap.
 */
export default function EraseScreen() {
  const db = useSQLiteContext();
  const { data: child } = useChild();
  const entries = useDbQuery(['event'], countEntries);
  const [typed, setTyped] = useState('');
  const sync = useSync();

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;
  const name = child?.name ?? 'your baby';
  const count = entries.data ?? 0;

  const backUpFirst = async () => {
    try {
      await shareBackup(db);
      await setSetting(db, 'lastBackupAt', Date.now());
    } catch (error) {
      Alert.alert('Backup failed', (error as Error).message);
    }
  };

  const erase = async () => {
    // Cancel a pending sleep reminder; nothing will be left to remind about.
    await syncSleepReminder(null).catch(() => {});
    // Starting over also leaves family sync (the other phones keep their copy).
    await sync.leave();
    // Once the profile is gone the app returns to the welcome screen on its own.
    await eraseAllData(db);
  };

  return (
    <Screen withTabBar={false} belowHeader>
      <View style={styles.group}>
        <ThemedText type="subtitle" style={styles.title}>
          Erase everything?
        </ThemedText>
        <ThemedText>
          This permanently deletes {name}&apos;s profile, all {count}{' '}
          {count === 1 ? 'entry' : 'entries'} and your settings from this phone (and stops family
          sync here; other phones keep their copy), and takes you back to the welcome screen. It
          can&apos;t be undone.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Make a backup first if you might want this data again — you can restore it later from the
          welcome screen.
        </ThemedText>
      </View>

      <SubmitButton
        title="Back up first"
        busyTitle="Preparing…"
        variant="secondary"
        onPress={backUpFirst}
      />

      <TextField
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={typed}
        onChangeText={setTyped}
        placeholder={CONFIRM_WORD}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
      />

      <SubmitButton
        title="Erase all data"
        busyTitle="Erasing…"
        variant="danger"
        disabled={!confirmed}
        onPress={erase}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  title: { fontSize: 26, lineHeight: 32 },
});
