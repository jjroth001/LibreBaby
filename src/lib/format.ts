import { startOfLocalDay } from './dates';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Coarse duration for summaries: "<1m", "42m", "1h 5m", "3h". */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / MINUTE);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** Running-timer display: "4:07", "42:13", "1:02:09". */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours === 0) return `${minutes}:${ss}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
}

/** "3:42 PM" (locale-dependent). */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * "7:56 – 8:17 AM": a span of clock times, with a shared AM/PM said once so it fits a
 * narrow row. Falls back to "11:40 AM – 12:10 PM" when the halves of the day differ.
 */
export function formatTimeRange(from: number, to: number): string {
  const a = formatTime(from);
  const b = formatTime(to);
  const period = /\s*[^\d\s:.]+\.?$/u;
  const pa = a.match(period)?.[0];
  if (pa && pa.trim() === b.match(period)?.[0].trim()) {
    return `${a.slice(0, -pa.length)} – ${b}`;
  }
  return `${a} – ${b}`;
}

/** "Today, 3:42 PM", "Yesterday, 11:05 PM", "Oct 3, 9:15 AM". */
export function formatDayTime(ms: number, now: number = Date.now()): string {
  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(ms)) / (24 * HOUR));
  const time = formatTime(ms);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  const date = new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

/** How long ago, in words for a summary line: "just now", "5 min ago", "3 hr ago", "2 days ago". */
export function formatAgo(ms: number, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - ms) / MINUTE);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
