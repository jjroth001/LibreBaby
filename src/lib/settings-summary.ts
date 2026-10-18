import type { Settings } from '@/db/settings';

import { formatAge } from './dates';
import { formatAgo } from './format';

/**
 * The one-line summaries under each row of the Settings menu: what's set now, so most
 * questions are answered without opening the page.
 */

export function babySummary(birthDate: string, now: Date = new Date()): string {
  const age = formatAge(birthDate, now);
  return age === 'Born today' || age === 'Not born yet' ? age : `${age} old`;
}

const APPEARANCE: Record<Settings['appearance'], string> = {
  sky: 'Sky follows the time of day',
  night: 'Night sky, all day',
  simple: 'Simple, plain colors',
};

export function appearanceSummary(s: Pick<Settings, 'appearance' | 'skyLocation'>): string {
  const look = APPEARANCE[s.appearance];
  return s.appearance === 'sky' && s.skyLocation ? `${look} · your sunrise` : look;
}

export function accessibilitySummary(
  s: Pick<Settings, 'highContrast' | 'reduceMotion' | 'haptics'>,
): string {
  const on = [
    s.highContrast && 'More contrast',
    s.reduceMotion && 'Less motion',
    s.haptics && 'Vibration',
  ].filter(Boolean);
  return on.length ? `${on.join(' · ')} on` : 'All off';
}

export function unitsSummary(s: Pick<Settings, 'volumeUnit' | 'growthUnits'>): string {
  const volume = s.volumeUnit === 'ml' ? 'Milliliters' : 'Ounces';
  const growth = s.growthUnits === 'metric' ? 'kg & cm' : 'lb & in';
  return `${volume} · ${growth}`;
}

export function notificationsSummary(
  s: Pick<Settings, 'sleepReminders' | 'sleepReminderLeadMin' | 'timerNotifications'>,
  supported: boolean,
): string {
  if (!supported) return 'Needs the installed app';
  const sleep = s.sleepReminders
    ? `Sleep window ${s.sleepReminderLeadMin} min before`
    : 'Sleep window off';
  return `${sleep} · Timer ${s.timerNotifications ? 'on' : 'off'}`;
}

export function medRemindersSummary(reminders: Settings['medReminders']): string {
  if (reminders.length === 0) return 'None yet';
  const on = reminders.filter((r) => r.enabled).length;
  const total = `${reminders.length} reminder${reminders.length === 1 ? '' : 's'}`;
  return on === reminders.length ? total : `${total} · ${on} on`;
}

export type SyncSummaryInput = {
  supported: boolean;
  /** undefined while loading. */
  joined: boolean | undefined;
  syncing: boolean;
  failed: boolean;
  /** The most recent sync with any phone (unix ms), if any. */
  lastSyncedAt: number | null;
  phones: number;
};

export function syncSummary(s: SyncSummaryInput, now: number = Date.now()): string {
  if (!s.supported) return 'Needs the installed app';
  if (s.joined === undefined) return '';
  if (!s.joined) return 'Off · share the log with family phones';
  if (s.syncing) return 'Syncing…';
  if (s.failed) return 'Last sync didn’t finish';
  if (s.phones === 0) return 'On · no other phones yet';
  return s.lastSyncedAt ? `Synced ${formatAgo(s.lastSyncedAt, now)}` : 'On · not synced yet';
}

export function backupSummary(lastBackupAt: number | null, now: number = Date.now()): string {
  return lastBackupAt ? `Backed up ${formatAgo(lastBackupAt, now)}` : 'No backup yet';
}
