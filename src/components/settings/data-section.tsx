import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import { Button } from '@/components/button';

import { SubmitButton } from '@/components/forms/submit-button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { importBackup, type Backup } from '@/db/backup';
import { setSetting } from '@/db/settings';
import { useNow } from '@/hooks/use-now';
import { importHuckleberry } from '@/db/huckleberry-import';
import type { Child, EventType } from '@/db/types';
import {
  pickBackup,
  pickHuckleberryExport,
  shareBackup,
  shareSpreadsheet,
} from '@/lib/data-transfer';
import type { HuckleberryParse } from '@/lib/huckleberry';
import { formatAgo } from '@/lib/format';
import type { GrowthUnits } from '@/lib/growth-units';
import type { VolumeUnit } from '@/lib/units';

const IMPORT_LABELS: Record<EventType, string> = {
  sleep: 'sleeps',
  feed_breast: 'breastfeeds',
  feed_bottle: 'bottles',
  feed_solids: 'solids',
  diaper: 'diapers',
  medication: 'medications',
  pump: 'pumping sessions',
  growth: 'measurements',
  milestone: 'milestones',
};

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

  const importFromHuckleberry = async () => {
    let parsed: HuckleberryParse | null;
    try {
      parsed = await pickHuckleberryExport();
    } catch (error) {
      Alert.alert('Couldn’t import', (error as Error).message);
      return;
    }
    if (!parsed) return;
    const picked = parsed;

    const found = Object.entries(picked.counts)
      .map(([type, n]) => `${n} ${IMPORT_LABELS[type as EventType]}`)
      .join(', ');
    const skipped = Object.entries(picked.skipped)
      .map(([reason, n]) => `${reason}: ${n}`)
      .join('\n');
    const message = [
      `Found ${picked.events.length} entries: ${found}.`,
      skipped && `Won’t be imported:\n${skipped}`,
      'Entries you’ve already logged in LibreBaby at the same time are skipped, so nothing is doubled.',
    ]
      .filter(Boolean)
      .join('\n\n');

    Alert.alert('Import from Huckleberry?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Import',
        onPress: async () => {
          try {
            const result = await importHuckleberry(db, child.id, picked);
            const notes = [
              result.matchedExisting &&
                `${result.matchedExisting} were already logged in LibreBaby`,
              result.alreadyImported && `${result.alreadyImported} were imported before`,
            ].filter(Boolean);
            Alert.alert(
              'Huckleberry data imported',
              `Added ${result.added} entries.${notes.length ? ` Skipped: ${notes.join('; ')}.` : ''}`,
            );
          } catch (error) {
            Alert.alert('Couldn’t import', (error as Error).message);
          }
        },
      },
    ]);
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
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        Everything is stored only on this phone. Back up regularly and save the file somewhere safe,
        like Google Drive.{' '}
        {lastBackupAt ? `Last backup ${formatAgo(lastBackupAt, now)}.` : 'No backup yet.'}
      </ThemedText>
      <SubmitButton title="Back up now" busyTitle="Preparing…" onPress={backUp} />
      <SubmitButton
        title="Restore from a backup"
        busyTitle="Opening…"
        variant="secondary"
        onPress={restore}
      />
      <SubmitButton
        title="Import from Huckleberry"
        busyTitle="Opening…"
        variant="secondary"
        onPress={importFromHuckleberry}
      />
      <SubmitButton
        title="Export spreadsheet (CSV)"
        busyTitle="Preparing…"
        variant="secondary"
        onPress={exportSpreadsheet}
      />
      <Button
        title="Erase all data…"
        variant="danger"
        onPress={() => router.push('/erase')}
        style={styles.erase}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  // Set apart from the everyday actions above.
  erase: { marginTop: Spacing.four },
});
