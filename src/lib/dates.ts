const DAY_MS = 24 * 60 * 60 * 1000;

/** `Date` → local calendar date string `YYYY-MM-DD` (no timezone shifting). */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` → `Date` at local midnight. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatLongDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Whole days since birth (0 on the birth date). */
export function ageInDays(birthDate: string, now: Date = new Date()): number {
  const birth = parseLocalDate(birthDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Round to absorb DST hour shifts.
  return Math.round((today.getTime() - birth.getTime()) / DAY_MS);
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** Human-friendly age: "5 days", "3 weeks, 2 days", "4 months, 1 week", "1 year, 2 months". */
export function formatAge(birthDate: string, now: Date = new Date()): string {
  const days = ageInDays(birthDate, now);
  if (days < 0) return 'Not born yet';
  if (days === 0) return 'Born today';
  if (days < 14) return plural(days, 'day');
  if (days < 8 * 7) {
    const weeks = Math.floor(days / 7);
    const rest = days % 7;
    return rest ? `${plural(weeks, 'week')}, ${plural(rest, 'day')}` : plural(weeks, 'week');
  }

  const birth = parseLocalDate(birthDate);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months--;

  if (months < 24) {
    const monthAnniversary = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate());
    const weeks = Math.floor(ageInDays(toLocalDateString(monthAnniversary), now) / 7);
    return weeks ? `${plural(months, 'month')}, ${plural(weeks, 'week')}` : plural(months, 'month');
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return restMonths ? `${plural(years, 'year')}, ${plural(restMonths, 'month')}` : plural(years, 'year');
}

/** Local midnight at the start of the day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight `days` days after the midnight `dayStart` (DST-safe, unlike adding 24h). */
export function addLocalDays(dayStart: number, days: number): number {
  const d = new Date(dayStart);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}
