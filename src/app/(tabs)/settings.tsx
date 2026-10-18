import { StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { MenuGroup } from '@/components/settings/settings-menu';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useChild } from '@/db/use-child';
import { useDbQuery } from '@/db/use-db-query';
import { useSettings } from '@/db/use-settings';
import { useNow } from '@/hooks/use-now';
import { remindersSupported } from '@/lib/notifications';
import {
  accessibilitySummary,
  appearanceSummary,
  babySummary,
  backupSummary,
  medRemindersSummary,
  notificationsSummary,
  syncSummary,
  unitsSummary,
} from '@/lib/settings-summary';
import { useSync } from '@/sync/sync-provider';

/** Settings: a short menu in four groups; each row shows what's set and opens its own page. */
export default function SettingsScreen() {
  const { data: child } = useChild();
  const { data: settings } = useSettings();
  const sync = useSync();
  const now = useNow(60_000);
  const peers = useDbQuery(['sync_peer'], (db) =>
    db.getFirstAsync<{ phones: number; lastSyncedAt: number | null }>(
      'SELECT COUNT(*) AS phones, MAX(last_synced_at) AS lastSyncedAt FROM sync_peer',
    ),
  );
  if (!child || !settings) return null;

  const syncLine = syncSummary(
    {
      supported: sync.supported,
      joined: sync.family === undefined ? undefined : sync.family !== null,
      syncing: sync.syncing,
      failed: sync.lastEvent?.type === 'error',
      lastSyncedAt: peers.data?.lastSyncedAt ?? null,
      phones: peers.data?.phones ?? 0,
    },
    now,
  );

  return (
    <Screen>
      <ThemedText style={styles.title}>Settings</ThemedText>

      <MenuGroup
        label="Baby"
        items={[
          {
            icon: 'baby',
            title: child.name,
            summary: babySummary(child.birthDate, new Date(now)),
            href: '/settings/profile',
          },
        ]}
      />

      <MenuGroup
        label="Look & feel"
        items={[
          {
            icon: 'sun-horizon',
            title: 'Appearance',
            summary: appearanceSummary(settings),
            href: '/settings/appearance',
          },
          {
            icon: 'sparkle',
            title: 'Accessibility',
            summary: accessibilitySummary(settings),
            href: '/settings/accessibility',
          },
          {
            icon: 'ruler',
            title: 'Units',
            summary: unitsSummary(settings),
            href: '/settings/units',
          },
        ]}
      />

      <MenuGroup
        label="Reminders"
        items={[
          {
            icon: 'bell',
            title: 'Notifications',
            summary: notificationsSummary(settings, remindersSupported),
            href: '/settings/notifications',
          },
          {
            icon: 'pill',
            title: 'Medicine reminders',
            summary: medRemindersSummary(settings.medReminders),
            href: '/settings/medicine',
          },
        ]}
      />

      <MenuGroup
        label="Family & data"
        items={[
          {
            icon: 'users-three',
            title: 'Family sync',
            summary: syncLine,
            href: '/settings/sync',
          },
          {
            icon: 'download-simple',
            title: 'Your data',
            summary: backupSummary(settings.lastBackupAt, now),
            href: '/settings/data',
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 42, fontWeight: 400 },
});
