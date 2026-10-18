import { formatDayTime, formatDuration, formatTime } from './format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * A medicine reminder, kept on this phone only (in settings). Doses logged on any family
 * phone count, since they arrive as ordinary medication entries.
 */
export type MedReminder = {
  id: string;
  /** Matched case-insensitively against logged medication names. */
  name: string;
  dose: string;
  enabled: boolean;
  /** `after`: a set number of hours after each logged dose. `times`: daily at set times. */
  kind: 'after' | 'times';
  hours: number;
  /** Minutes after local midnight, e.g. 480 for 8:00 AM. */
  times: number[];
};

export type PlannedReminder = {
  /** Notification identifier; all start with MED_PREFIX so they can be found and replaced. */
  id: string;
  /** The MedReminder this comes from; a tapped notification opens the log by this id. */
  reminderId: string;
  at: number;
  title: string;
  body: string;
  name: string;
  dose: string;
};

export const MED_PREFIX = 'med-';

/** How far ahead daily reminders are scheduled; every app start or change tops them up. */
export const DAILY_HORIZON_DAYS = 14;

/** A daily reminder is skipped when a dose was logged within this long before it. */
export const SKIP_IF_GIVEN_WITHIN = HOUR;

export const medKey = (name: string) => name.trim().toLowerCase();

/** "6 h after each dose", "Every day at 8:00 AM and 8:00 PM". */
export function describeSchedule(reminder: MedReminder): string {
  if (reminder.kind === 'after') return `${reminder.hours} h after each dose`;
  if (reminder.times.length === 0) return 'No times set';
  return `Every day at ${joinTimes(sortedTimes(reminder.times).map(formatMinutes))}`;
}

/** 480 → "8:00 AM" (locale-dependent). */
export function formatMinutes(minutes: number): string {
  return formatTime(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).getTime());
}

export function sortedTimes(times: number[]): number[] {
  return [...new Set(times)].sort((a, b) => a - b);
}

function joinTimes(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The next time an `after` reminder fires, or null if it never would. */
export function nextAfterDose(reminder: MedReminder, lastGivenAt: number | undefined) {
  return lastGivenAt === undefined ? null : lastGivenAt + reminder.hours * HOUR;
}

/**
 * Every notification the reminders call for from `now` on: one per `after` reminder (if
 * that medicine was ever logged), and each daily time over the next two weeks, minus any
 * right after a logged dose. `lastGiven` maps medKey(name) → latest dose time.
 */
export function planMedReminders(
  reminders: MedReminder[],
  lastGiven: Map<string, number>,
  now: number,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const reminder of reminders) {
    if (!reminder.enabled || !reminder.name.trim()) continue;
    const last = lastGiven.get(medKey(reminder.name));
    const make = (at: number, n: number): PlannedReminder => ({
      id: `${MED_PREFIX}${reminder.id}-${n}`,
      reminderId: reminder.id,
      at,
      title: `Time for ${reminder.name.trim()}`,
      body: reminderBody(reminder.dose, last, at),
      name: reminder.name.trim(),
      dose: reminder.dose,
    });

    if (reminder.kind === 'after') {
      const at = nextAfterDose(reminder, last);
      if (at !== null && at > now) planned.push(make(at, 0));
      continue;
    }

    const today = new Date(now);
    let n = 0;
    for (let day = 0; day <= DAILY_HORIZON_DAYS; day++) {
      for (const minutes of sortedTimes(reminder.times)) {
        const at = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + day,
          Math.floor(minutes / 60),
          minutes % 60,
        ).getTime();
        if (at <= now) continue;
        if (last !== undefined && last <= at && at - last < SKIP_IF_GIVEN_WITHIN) continue;
        planned.push(make(at, n++));
      }
    }
  }
  return planned.sort((a, b) => a.at - b.at);
}

/** "2.5 ml · last given 6h ago, Today, 2:45 PM", worded as of when it's shown. */
function reminderBody(dose: string, last: number | undefined, at: number): string {
  const lastPart =
    last === undefined || last > at
      ? null
      : `last given ${formatDuration(at - last)} ago (${formatDayTime(last, at)})`;
  return [dose.trim(), lastPart].filter(Boolean).join(' · ') || 'Tap to log a dose';
}

/**
 * The medicine and dose to fill in when a reminder is tapped, looked up from this phone's
 * own settings so a link into the app can't pre-fill something the family never set up.
 */
export function prefillFromReminder(
  reminders: MedReminder[],
  reminderId: string | undefined,
): { name: string; dose: string } {
  const reminder = reminderId ? reminders.find((r) => r.id === reminderId) : undefined;
  return reminder ? { name: reminder.name.trim(), dose: reminder.dose } : { name: '', dose: '' };
}

/** The "after each dose" reminder for this medicine, if one is set up. */
export function afterDoseReminder(reminders: MedReminder[], name: string) {
  const key = medKey(name);
  return reminders.find((r) => r.kind === 'after' && medKey(r.name) === key);
}

/** The first daily reminder for this medicine, if one is set up and on. */
export function dailyReminder(reminders: MedReminder[], name: string) {
  const key = medKey(name);
  return reminders.find((r) => r.kind === 'times' && r.enabled && medKey(r.name) === key);
}

/**
 * The reminder list after logging a dose with "Remind me for the next dose" `on` (every
 * `hours`) or off, or null when nothing changes. Turning it off keeps the reminder in
 * Settings, switched off, so its hours are remembered.
 */
export function withAfterDoseChoice(
  reminders: MedReminder[],
  dose: { name: string; dose: string },
  choice: { on: boolean; hours: number },
  newId: () => string,
): MedReminder[] | null {
  const existing = afterDoseReminder(reminders, dose.name);
  if (!choice.on) {
    if (!existing?.enabled) return null;
    return reminders.map((r) => (r === existing ? { ...r, enabled: false } : r));
  }
  if (existing) {
    const updated = {
      ...existing,
      enabled: true,
      hours: choice.hours,
      dose: dose.dose || existing.dose,
    };
    return reminders.map((r) => (r === existing ? updated : r));
  }
  return [
    ...reminders,
    {
      id: newId(),
      name: dose.name,
      dose: dose.dose,
      enabled: true,
      kind: 'after',
      hours: choice.hours,
      times: [],
    },
  ];
}
