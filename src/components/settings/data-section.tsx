import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';

import { SubmitButton } from '@/components/forms/submit-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { importBackup, type Backup } from '@/db/backup';
import { setSetting } from '@/db/settings';
import type { Child } from '@/db/types';
import { useNow } from '@/hooks/use-now';
import { pickBackup, shareBackup, shareSpreadsheet } from '@/lib/data-transfer';
import { formatDuration } from '@/lib/format';
import type { GrowthUnits } from '@/lib/growth-units';
import type { VolumeUnit } from '@/lib/units';

function backupSummary(backup: Backup): string {
  const live = backup.events.filter((e) => e.deleted_at === null);
  if (live.length === 0) return 'This backup has no entries.';
  const first = new Date(Math.min(...live.map((e) => e.start_at))).toLocaleDateString();
  const last = new Date(Math.max(...live.map((e) => e.start_at))).toLocaleDateString();
  return `It has ${live.length} entries, from ${first} to ${last}.`;
}

type DataSectionProps = {
  child: Child;
  unit: VolumeUnit;
  growthUnits: GrowthUnits;
  lastBackupAt: number | null;
};

/** Backup, restore and spreadsheet export. */
export function DataSection({ child, unit, growthUnits, lastBackupAt }: DataSectionProps) {
  const db = useSQLiteContext();
  const now = useNow(60_000);

  const backUp = async () => {
    try {
      await shareBackup(db);
      await setSetting(db, 'lastBackupAt', Date.now());
    } catch (error) {
      Alert.alert('Backup failed', (error as Error).message);
    }
  };

  const exportSpreadsheet = async () => {
    try {
      await shareSpreadsheet(db, unit, growthUnits);
    } catch (error) {
      Alert.alert('Export failed', (error as Error).message);
    }
  };

  const restore = async () => {
    let backup: Backup | null;
    try {
      backup = await pickBackup();
    } catch (error) {
      Alert.alert('Couldn’t restore', (error as Error).message);
      return;
    }
    if (!backup) return;
    const picked = backup;

    Alert.alert(
      'Restore this backup?',
      `${backupSummary(picked)}\n\nIt’s merged with what’s on this phone: new entries are added, and where the same entry exists in both, the more recently edited one wins.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              const result = await importBackup(db, picked, child.id);
              Alert.alert(
                'Backup restored',
                `${result.added} added, ${result.updated} updated, ${result.unchanged} already here.`,
              );
            } catch (error) {
              Alert.alert('Couldn’t restore', (error as Error).message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Your data</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Everything is stored only on this phone. Back up regularly and save the file somewhere safe,
        like Google Drive.{' '}
        {lastBackupAt ? `Last backup ${formatDuration(now - lastBackupAt)} ago.` : 'No backup yet.'}
      </ThemedText>
      <SubmitButton title="Back up now" busyTitle="Preparing…" onPress={backUp} />
      <SubmitButton
        title="Restore from a backup"
        busyTitle="Opening…"
        variant="secondary"
        onPress={restore}
      />
      <SubmitButton
        title="Export spreadsheet (CSV)"
        busyTitle="Preparing…"
        variant="secondary"
        onPress={exportSpreadsheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
});
