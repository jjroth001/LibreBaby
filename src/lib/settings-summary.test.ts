import { formatAgo } from './format';
import {
  accessibilitySummary,
  appearanceSummary,
  babySummary,
  backupSummary,
  medRemindersSummary,
  notificationsSummary,
  syncSummary,
  unitsSummary,
} from './settings-summary';

const MIN = 60_000;
const now = new Date(2026, 9, 18, 12).getTime();

describe('formatAgo', () => {
  it('reads like a person would say it', () => {
    expect(formatAgo(now - 20_000, now)).toBe('just now');
    expect(formatAgo(now - 5 * MIN, now)).toBe('5 min ago');
    expect(formatAgo(now - 3 * 60 * MIN, now)).toBe('3 hr ago');
    expect(formatAgo(now - 30 * 60 * MIN, now)).toBe('yesterday');
    expect(formatAgo(now - 3 * 24 * 60 * MIN, now)).toBe('3 days ago');
    expect(formatAgo(now + MIN, now)).toBe('just now'); // clocks a little ahead
  });
});

describe('Settings summaries', () => {
  it('baby: age', () => {
    expect(babySummary('2026-03-14', new Date(2026, 9, 18))).toBe('7 months old');
    expect(babySummary('2026-10-18', new Date(2026, 9, 18))).toBe('Born today');
  });

  it('appearance', () => {
    expect(appearanceSummary({ appearance: 'sky', skyLocation: null })).toBe(
      'Sky follows the time of day',
    );
    expect(
      appearanceSummary({ appearance: 'sky', skyLocation: { lat: 1, lon: 2, updatedAt: 0 } }),
    ).toBe('Sky follows the time of day · your sunrise');
    expect(
      appearanceSummary({ appearance: 'night', skyLocation: { lat: 1, lon: 2, updatedAt: 0 } }),
    ).toBe('Night sky, all day');
  });

  it('accessibility', () => {
    expect(accessibilitySummary({ highContrast: false, reduceMotion: false, haptics: true })).toBe(
      'Vibration on',
    );
    expect(accessibilitySummary({ highContrast: true, reduceMotion: true, haptics: false })).toBe(
      'More contrast · Less motion on',
    );
    expect(accessibilitySummary({ highContrast: false, reduceMotion: false, haptics: false })).toBe(
      'All off',
    );
  });

  it('units', () => {
    expect(unitsSummary({ volumeUnit: 'ml', growthUnits: 'metric' })).toBe('Milliliters · kg & cm');
    expect(unitsSummary({ volumeUnit: 'oz', growthUnits: 'imperial' })).toBe('Ounces · lb & in');
  });

  it('notifications', () => {
    const s = { sleepReminders: true, sleepReminderLeadMin: 15, timerNotifications: true };
    expect(notificationsSummary(s, true)).toBe('Sleep window 15 min before · Timer on');
    expect(
      notificationsSummary({ ...s, sleepReminders: false, timerNotifications: false }, true),
    ).toBe('Sleep window off · Timer off');
    expect(notificationsSummary(s, false)).toBe('Needs the installed app');
  });

  it('medicine reminders', () => {
    const r = (enabled: boolean) => ({ enabled }) as never;
    expect(medRemindersSummary([])).toBe('None yet');
    expect(medRemindersSummary([r(true)])).toBe('1 reminder');
    expect(medRemindersSummary([r(true), r(false)])).toBe('2 reminders · 1 on');
  });

  it('family sync', () => {
    const base = {
      supported: true,
      joined: true,
      syncing: false,
      failed: false,
      lastSyncedAt: now - 5 * MIN,
      phones: 1,
    };
    expect(syncSummary(base, now)).toBe('Synced 5 min ago');
    expect(syncSummary({ ...base, syncing: true }, now)).toBe('Syncing…');
    expect(syncSummary({ ...base, phones: 0, lastSyncedAt: null }, now)).toBe(
      'On · no other phones yet',
    );
    expect(syncSummary({ ...base, joined: false }, now)).toBe(
      'Off · share the log with family phones',
    );
    expect(syncSummary({ ...base, supported: false }, now)).toBe('Needs the installed app');
  });

  it('your data', () => {
    expect(backupSummary(null, now)).toBe('No backup yet');
    expect(backupSummary(now - 3 * 24 * 60 * MIN, now)).toBe('Backed up 3 days ago');
  });
});
