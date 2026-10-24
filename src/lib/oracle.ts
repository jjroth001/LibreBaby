import type { BabyEvent } from '@/db/types';

import { addLocalDays, startOfLocalDay } from './dates';
import { formatDayTime, formatDuration, formatTime } from './format';
import { ageWakeWindow, predictNextSleep } from './sleep-prediction';

/**
 * The Oracle: a day outline (naps, feeds, diapers, bedtime, night feeds, tomorrow's wake-up)
 * built from the last two weeks of entries. Everything here is plain arithmetic on the
 * child's own history — medians and spreads — falling back to broad, commonly published
 * ranges for their age while there isn't enough history. A guide, not a rule.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const ORACLE_LOOKBACK_DAYS = 14;
/** Fewer days with entries than this, and the outline leans on age-typical ranges. */
const LEARNING_DAYS = 3;
/** A pattern needs this many examples before it can be called "likely". */
const MIN_SAMPLES = 5;
/** Feeds this close together count as one feeding (e.g. breast, then a bottle top-up). */
const FEED_SESSION_GAP = 30 * MINUTE;
/** The first sleep of the evening at least this long is bedtime. */
const NIGHT_MIN_MS = 90 * MINUTE;
/** Sleeps that start after this (minutes past midnight) or before NIGHT_START_ENDS can be bedtime. */
const NIGHT_START_FROM = 17 * 60 + 30;
const NIGHT_START_ENDS = 2 * 60;
/** Night wakings shorter than this keep the night going. */
const NIGHT_GAP_MAX = 3 * HOUR;
/** A wet change this close to an expected dirty one is the same change. */
const SAME_CHANGE = 45 * MINUTE;
/** Dirty diapers can be days apart; look back this far for the last one. */
const DIRTY_RECENT = 4 * DAY;

export type OracleKind =
  | 'nap'
  /** The nap happening now: when it should end. */
  | 'nap-end'
  | 'bedtime'
  /** Awake in the night: when they'll likely settle again. */
  | 'back-to-sleep'
  | 'wake'
  | 'feed'
  | 'wet-diaper'
  | 'dirty-diaper';

/** Which diaper estimates to show: wet and dirty, or only dirty ones. */
export type OracleDiapers = 'all' | 'dirty';

export type Confidence = 'likely' | 'maybe';

export type OracleItem = {
  id: string;
  kind: OracleKind;
  /** Best guess. */
  at: number;
  /** Window it will probably fall in. */
  from: number;
  to: number;
  /** Naps: when it should end. */
  endAt: number | null;
  confidence: Confidence;
  /** Part of the night (between bedtime and the morning wake-up). */
  night: boolean;
  /** At or past due: the best guess is "now". */
  due: boolean;
  /** Plain sentences on how the estimate was made. */
  reasons: string[];
};

export type Forecast = {
  now: number;
  /** Set when a sleep is running. */
  asleepSince: number | null;
  /** Set when awake and a sleep has been logged. */
  awakeSince: number | null;
  /** Too little history yet; mostly age-typical ranges. */
  learning: boolean;
  /** Days in the lookback that have at least one entry. */
  daysOfData: number;
  items: OracleItem[];
};

/* Small statistics ------------------------------------------------------------------------- */

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** A typical value, how much it varies (interquartile range) and how many examples. */
type Stat = { median: number; spread: number; n: number; personal: boolean };

function statOf(values: number[], fallback: number, fallbackSpread: number, min = 3): Stat {
  if (values.length < min) {
    return { median: fallback, spread: fallbackSpread, n: values.length, personal: false };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: quantile(sorted, 0.5),
    spread: quantile(sorted, 0.75) - quantile(sorted, 0.25),
    n: values.length,
    personal: true,
  };
}

/** Enough examples, and they agree with each other. */
function consistent(stat: Stat, tolerance: number): boolean {
  return stat.personal && stat.n >= MIN_SAMPLES && stat.spread <= tolerance;
}

/* Clock helpers ------------------------------------------------------------------------------ */

/** Minutes past local midnight. */
function minuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** `minutes` past local midnight of `dayStart` (may exceed 24h for "after midnight"). */
function atClock(dayStart: number, minutes: number): number {
  const d = new Date(dayStart);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, Math.round(minutes)).getTime();
}

function canStartNight(ms: number): boolean {
  const m = minuteOfDay(ms);
  return m >= NIGHT_START_FROM || m < NIGHT_START_ENDS;
}

/** The local day whose evening a night sleep belongs to. */
function eveningOf(ms: number): number {
  const day = startOfLocalDay(ms);
  return minuteOfDay(ms) < 12 * 60 ? addLocalDays(day, -1) : day;
}

/* Age-typical fallbacks: broad, commonly published ranges ------------------------------------ */

function feedIntervalFor(ageDays: number): number {
  if (ageDays < 30) return 2.5 * HOUR;
  if (ageDays < 90) return 3 * HOUR;
  if (ageDays < 180) return 3.5 * HOUR;
  return 4 * HOUR;
}

function diaperIntervalFor(ageDays: number): number {
  if (ageDays < 30) return 2.5 * HOUR;
  if (ageDays < 180) return 3 * HOUR;
  return 3.5 * HOUR;
}

/** Dirty diapers slow down a lot after the first weeks; these are only rough placeholders. */
function dirtyIntervalFor(ageDays: number): number {
  if (ageDays < 30) return 6 * HOUR;
  if (ageDays < 90) return 12 * HOUR;
  return DAY;
}

function napLengthFor(ageDays: number): number {
  if (ageDays < 90) return 45 * MINUTE;
  if (ageDays < 365) return 60 * MINUTE;
  return 90 * MINUTE;
}

/** Bedtime as minutes past midnight. Newborns don't have one yet; this is only a placeholder. */
function bedtimeFor(ageDays: number): number {
  return ageDays < 60 ? 21 * 60 + 30 : 19 * 60 + 30;
}

function nightFeedsFor(ageDays: number): { count: number; stretch: number; gap: number } {
  if (ageDays < 30) return { count: 3, stretch: 3 * HOUR, gap: 3 * HOUR };
  if (ageDays < 90) return { count: 2, stretch: 4 * HOUR, gap: 3.5 * HOUR };
  if (ageDays < 180) return { count: 1, stretch: 5 * HOUR, gap: 4 * HOUR };
  return { count: 0, stretch: 6 * HOUR, gap: 4 * HOUR };
}

/* Learning from history ---------------------------------------------------------------------- */

type Night = { start: number; end: number; sleeps: BabyEvent<'sleep'>[] };

type Patterns = {
  ageDays: number;
  daysOfData: number;
  nights: Night[];
  napWakeWindows: number[];
  napLength: Stat;
  /** Nap lengths by position in the day (first nap, second…); catnaps tend to be short. */
  napLengthByIndex: Stat[];
  /** Naps already finished today. */
  napsToday: number;
  /** Minutes past midnight; after-midnight bedtimes are past 24h. */
  bedtime: Stat;
  morningWake: Stat;
  feedGap: Stat;
  nightStretch: Stat;
  nightFeedGap: Stat;
  nightFeedCount: Stat;
  morningFeedDelay: Stat;
  /** Time from one change to the next wet one, by day. */
  wetGap: Stat;
  /** Time between dirty diapers, day or night. */
  dirtyGap: Stat;
  nightDiaperCount: Stat;
};

function isWet(e: BabyEvent): boolean {
  return e.type === 'diaper' && (e as BabyEvent<'diaper'>).data.wet;
}

function isDirty(e: BabyEvent): boolean {
  return e.type === 'diaper' && (e as BabyEvent<'diaper'>).data.dirty;
}

function feedSessions(events: BabyEvent[]): number[] {
  const starts: number[] = [];
  let lastEnd = -Infinity;
  for (const e of events) {
    if (e.type !== 'feed_breast' && e.type !== 'feed_bottle') continue;
    if (e.startAt - lastEnd > FEED_SESSION_GAP) starts.push(e.startAt);
    lastEnd = Math.max(lastEnd, e.endAt ?? e.startAt);
  }
  return starts;
}

/** Bedtime sleep plus the night wakings that follow it, one per evening. */
function findNights(sleeps: BabyEvent<'sleep'>[]): Night[] {
  const nights: Night[] = [];
  const seenEvenings = new Set<number>();
  for (let i = 0; i < sleeps.length; i++) {
    const s = sleeps[i];
    if (s.endAt == null || !canStartNight(s.startAt)) continue;
    if (s.endAt - s.startAt < NIGHT_MIN_MS) continue;
    const evening = eveningOf(s.startAt);
    if (seenEvenings.has(evening)) continue;
    seenEvenings.add(evening);

    const chain = [s];
    for (let j = i + 1; j < sleeps.length; j++) {
      const next = sleeps[j];
      const prevEnd = chain[chain.length - 1].endAt!;
      if (next.endAt == null || next.startAt - prevEnd > NIGHT_GAP_MAX) break;
      // Past early morning, the next sleep is a nap.
      if (minuteOfDay(next.startAt) >= 7 * 60 && minuteOfDay(next.startAt) < 17 * 60) break;
      chain.push(next);
    }
    nights.push({ start: s.startAt, end: chain[chain.length - 1].endAt!, sleeps: chain });
  }
  return nights;
}

function inNight(nights: Night[], ms: number): Night | undefined {
  return nights.find((n) => ms >= n.start && ms <= n.end);
}

function learn(events: BabyEvent[], ageDays: number, now: number): Patterns {
  const today = startOfLocalDay(now);
  const days = new Set(
    events.filter((e) => e.startAt < today).map((e) => startOfLocalDay(e.startAt)),
  );

  const sleeps = events.filter((e): e is BabyEvent<'sleep'> => e.type === 'sleep');
  const finished = sleeps.filter((s) => s.endAt != null);
  const nights = findNights(finished);
  const nightSleepIds = new Set(nights.flatMap((n) => n.sleeps.map((s) => s.id)));
  const naps = finished.filter((s) => !nightSleepIds.has(s.id));

  // Awake time before each nap, and nap lengths.
  const napWakeWindows: number[] = [];
  const napLengths: number[] = [];
  const byIndex: number[][] = [];
  const napsPerDay = new Map<number, number>();
  for (const nap of naps) {
    const length = nap.endAt! - nap.startAt;
    const day = startOfLocalDay(nap.startAt);
    const index = napsPerDay.get(day) ?? 0;
    napsPerDay.set(day, index + 1);
    if (length >= 10 * MINUTE && length <= 4 * HOUR) {
      napLengths.push(length);
      (byIndex[index] ??= []).push(length);
    }
    const before = finished.filter((s) => s.endAt! <= nap.startAt).at(-1);
    if (!before) continue;
    const gap = nap.startAt - before.endAt!;
    if (gap >= 15 * MINUTE && gap <= 8 * HOUR) napWakeWindows.push(gap);
  }

  const bedtimes = nights.map((n) => {
    const m = minuteOfDay(n.start);
    return m < 12 * 60 ? m + 24 * 60 : m;
  });
  const wakes = nights.map((n) => minuteOfDay(n.end)).filter((m) => m >= 4 * 60 && m < 11 * 60);

  // Feeds: daytime gaps, the first stretch of the night, gaps between night feeds.
  const feeds = feedSessions(events);
  const dayFeedGaps: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    const gap = feeds[i] - feeds[i - 1];
    if (inNight(nights, feeds[i]) || inNight(nights, feeds[i - 1])) continue;
    if (gap >= 30 * MINUTE && gap <= 6 * HOUR) dayFeedGaps.push(gap);
  }
  const stretches: number[] = [];
  const nightGaps: number[] = [];
  const nightCounts: number[] = [];
  const morningDelays: number[] = [];
  const diaperEvents = events.filter((e) => e.type === 'diaper');
  const diapers = diaperEvents.map((e) => e.startAt);
  const nightDiaperCounts: number[] = [];
  for (const night of nights) {
    // Only nights that are over and fully inside the lookback teach anything.
    if (night.end > now) continue;
    const during = feeds.filter((f) => f > night.start + 20 * MINUTE && f < night.end);
    nightCounts.push(during.length);
    if (during.length) stretches.push(during[0] - night.start);
    for (let i = 1; i < during.length; i++) nightGaps.push(during[i] - during[i - 1]);
    const firstAfter = feeds.find((f) => f >= night.end - 15 * MINUTE);
    if (firstAfter != null && firstAfter - night.end <= 2 * HOUR) {
      morningDelays.push(Math.max(0, firstAfter - night.end));
    }
    nightDiaperCounts.push(diapers.filter((d) => d > night.start && d < night.end).length);
  }

  // Any change puts on a fresh diaper, so a wet one counts from whatever change came before.
  const wetGaps: number[] = [];
  for (let i = 1; i < diaperEvents.length; i++) {
    if (!isWet(diaperEvents[i])) continue;
    if (inNight(nights, diapers[i]) || inNight(nights, diapers[i - 1])) continue;
    const gap = diapers[i] - diapers[i - 1];
    if (gap >= 20 * MINUTE && gap <= 8 * HOUR) wetGaps.push(gap);
  }
  const dirty = diaperEvents.filter(isDirty).map((e) => e.startAt);
  const dirtyGaps: number[] = [];
  for (let i = 1; i < dirty.length; i++) {
    const gap = dirty[i] - dirty[i - 1];
    if (gap >= 20 * MINUTE && gap <= DIRTY_RECENT) dirtyGaps.push(gap);
  }

  const nightFallback = nightFeedsFor(ageDays);
  const napLength = statOf(napLengths, napLengthFor(ageDays), 30 * MINUTE);
  return {
    ageDays,
    daysOfData: days.size,
    nights,
    napWakeWindows,
    napLength,
    napLengthByIndex: Array.from(byIndex, (lengths) =>
      statOf(lengths ?? [], napLength.median, napLength.spread),
    ),
    napsToday: napsPerDay.get(today) ?? 0,
    bedtime: statOf(bedtimes, bedtimeFor(ageDays), 60),
    morningWake: statOf(wakes, 7 * 60, 60),
    feedGap: statOf(dayFeedGaps, feedIntervalFor(ageDays), 45 * MINUTE),
    nightStretch: statOf(stretches, nightFallback.stretch, HOUR),
    nightFeedGap: statOf(nightGaps, nightFallback.gap, HOUR),
    nightFeedCount: statOf(nightCounts, nightFallback.count, 1),
    morningFeedDelay: statOf(morningDelays, 15 * MINUTE, 15 * MINUTE),
    wetGap: statOf(wetGaps, diaperIntervalFor(ageDays), HOUR),
    dirtyGap: statOf(dirtyGaps, dirtyIntervalFor(ageDays), dirtyIntervalFor(ageDays) / 2),
    nightDiaperCount: statOf(nightDiaperCounts, 0, 1),
  };
}

function napLengthAt(p: Patterns, index: number): Stat {
  const stat = p.napLengthByIndex[index];
  return stat?.personal ? stat : p.napLength;
}

function napLengthReason(length: Stat, ageDays: number): string {
  return length.personal
    ? `This nap usually lasts about ${formatDuration(length.median)} (${examples(length, 'naps')}).`
    : `Naps at ${ageLabel(ageDays)} often last about ${formatDuration(length.median)}.`;
}

/* Building the outline ----------------------------------------------------------------------- */

function window(at: number, spread: number, step: number): { from: number; to: number } {
  // Uncertainty grows the further each guess is chained from something that really happened.
  const half = Math.min(Math.max((spread / 2) * Math.sqrt(step), 10 * MINUTE), 75 * MINUTE);
  return { from: at - half, to: at + half };
}

function examples(stat: Stat, what: string): string {
  return `${stat.n} ${what}, last ${ORACLE_LOOKBACK_DAYS} days`;
}

function ageLabel(ageDays: number): string {
  if (ageDays < 14) return `${ageDays} days`;
  if (ageDays < 60) return `${Math.floor(ageDays / 7)} weeks`;
  return `${Math.floor(ageDays / 30.44)} months`;
}

export type ForecastInput = {
  /** Entries from the last ~two weeks up to now, oldest first. */
  events: BabyEvent[];
  ageDays: number;
  now: number;
  /** Default: all. */
  diapers?: OracleDiapers;
};

export function buildForecast({ events, ageDays, now, diapers = 'all' }: ForecastInput): Forecast {
  const sorted = [...events].sort((a, b) => a.startAt - b.startAt);
  const p = learn(sorted, ageDays, now);
  const learning = p.daysOfData < LEARNING_DAYS;
  const items: OracleItem[] = [];
  const add = (item: Omit<OracleItem, 'id' | 'confidence'> & { confidence: Confidence }) =>
    items.push({ ...item, id: '', confidence: learning ? 'maybe' : item.confidence });

  const sleeps = sorted.filter((e): e is BabyEvent<'sleep'> => e.type === 'sleep');
  const running = sleeps.find((s) => s.endAt == null && s.startAt <= now) ?? null;
  const finished = sleeps.filter((s) => s.endAt != null && s.endAt <= now);
  const lastWoke = finished.length ? Math.max(...finished.map((s) => s.endAt!)) : null;
  const feeds = feedSessions(sorted.filter((e) => e.startAt <= now));
  // Ignore a "last" entry from long ago (logging paused); counting from it would be noise.
  const recent = (ms: number | null) => (ms != null && now - ms < 12 * HOUR ? ms : null);
  const lastFeed = recent(feeds.at(-1) ?? null);
  const pastDiapers = sorted.filter((e) => e.type === 'diaper' && e.startAt <= now);
  const lastDiaper = recent(pastDiapers.at(-1)?.startAt ?? null);
  const lastDirty = pastDiapers.filter(isDirty).at(-1)?.startAt ?? null;

  // Day or night? Asleep since the evening, or awake in the small hours / between night sleeps.
  const today = startOfLocalDay(now);
  const lastEvening = minuteOfDay(now) < 12 * 60 ? addLocalDays(today, -1) : today;
  let evening = today;
  let nightStarted = false;
  if (running) {
    const runningEvening = eveningOf(running.startAt);
    const bedtimeThen = atClock(runningEvening, p.bedtime.median);
    if (canStartNight(running.startAt) && running.startAt >= bedtimeThen - 90 * MINUTE) {
      evening = runningEvening;
      nightStarted = true;
    }
  } else {
    const loggedNight = p.nights.find((n) => eveningOf(n.start) === lastEvening);
    const morningCutoff = atClock(addLocalDays(lastEvening, 1), p.morningWake.median - 60);
    if (loggedNight && now < morningCutoff && now - loggedNight.end < NIGHT_GAP_MAX) {
      evening = lastEvening;
      nightStarted = true;
    } else if (minuteOfDay(now) < 4 * 60) {
      evening = lastEvening;
      nightStarted = true;
    }
  }
  const plannedBedtime = atClock(evening, p.bedtime.median);
  const loggedNight = p.nights.find((n) => eveningOf(n.start) === evening && n.start <= now);
  const morningDay = addLocalDays(evening, 1);
  let wakeAt = atClock(morningDay, p.morningWake.median);

  const ww = predictNextSleep({ ageDays, lastWokeAt: 0, recentWindows: p.napWakeWindows });
  const wwCenter = (ww.opensAt + ww.closesAt) / 2;
  const wwStat = statOf(p.napWakeWindows, wwCenter, ww.closesAt - ww.opensAt);
  const ageRange = ageWakeWindow(ageDays);
  const wwReasons = (from: number) => [
    `Awake from ${formatTime(from)}.`,
    wwStat.personal
      ? `Awake about ${formatDuration(wwStat.median)} before naps lately (${examples(wwStat, 'naps')}).`
      : `Not enough naps logged yet to learn their own rhythm.`,
    `Typical for ${ageLabel(ageDays)}: ${formatDuration(ageRange.minMs)} – ${formatDuration(ageRange.maxMs)} awake.`,
  ];

  // Sleep: naps until bedtime, then the night ----------------------------------------------
  const naps: { start: number; end: number }[] = [];
  let bedtime: number;

  if (!nightStarted) {
    const knownWake = lastWoke != null && now - lastWoke < 10 * HOUR;
    let awakeFrom = knownWake ? lastWoke : now;
    let step = 1;
    if (running) {
      const length = napLengthAt(p, p.napsToday);
      const end = Math.max(running.startAt + length.median, now + 5 * MINUTE);
      add({
        kind: 'nap-end',
        at: end,
        ...window(end, length.spread, 1),
        endAt: null,
        night: false,
        due: end <= now + 5 * MINUTE,
        confidence: consistent(length, 20 * MINUTE) ? 'likely' : 'maybe',
        reasons: [
          `Fell asleep at ${formatTime(running.startAt)}.`,
          napLengthReason(length, ageDays),
        ],
      });
      naps.push({ start: running.startAt, end });
      awakeFrom = end;
      step = 2;
    }

    // Keep adding naps while one still fits before bedtime.
    while (naps.length < 8) {
      const start = Math.max(awakeFrom + wwCenter, now);
      const length = napLengthAt(p, p.napsToday + naps.length);
      const end = start + length.median;
      const tooLate = end + ageRange.minMs > plannedBedtime + 20 * MINUTE;
      if (tooLate) break;
      const reasons = [...wwReasons(awakeFrom), napLengthReason(length, ageDays)];
      if (step > 1) {
        reasons[0] = `Expected to wake from the nap before at about ${formatTime(awakeFrom)}.`;
      } else if (!knownWake && !running) {
        reasons[0] = 'No recent sleep logged, so counting from now.';
      }
      add({
        kind: 'nap',
        at: start,
        ...window(start, wwStat.spread, step),
        endAt: end,
        night: false,
        due: start <= now,
        confidence: step <= 2 && consistent(wwStat, 30 * MINUTE) ? 'likely' : 'maybe',
        reasons,
      });
      naps.push({ start, end });
      awakeFrom = end;
      step++;
    }

    // Bedtime: their usual time, nudged so the last awake stretch isn't far too short or long.
    bedtime = Math.min(
      Math.max(plannedBedtime, awakeFrom + ageRange.minMs),
      awakeFrom + ageRange.maxMs * 1.5,
    );
    bedtime = Math.max(bedtime, now);
    add({
      kind: 'bedtime',
      at: bedtime,
      ...window(bedtime, p.bedtime.spread * MINUTE, 1),
      endAt: null,
      night: false,
      due: bedtime <= now,
      confidence: consistent(p.bedtime, 45) && step <= 4 ? 'likely' : 'maybe',
      reasons: [
        p.bedtime.personal
          ? `Bedtime has been around ${formatTime(plannedBedtime)} (${examples(p.bedtime, 'nights')}).`
          : `Not enough nights logged yet; ${formatTime(plannedBedtime)} is a common bedtime at this age.`,
        ...(bedtime !== plannedBedtime
          ? [`Moved to ${formatTime(bedtime)} so the last awake stretch fits their age.`]
          : []),
      ],
    });
  } else {
    bedtime = running?.startAt ?? loggedNight?.start ?? plannedBedtime;
    if (!running) {
      const settle = now + Math.min(ageRange.minMs / 2, 30 * MINUTE);
      add({
        kind: 'back-to-sleep',
        at: settle,
        ...window(settle, 30 * MINUTE, 1),
        endAt: null,
        night: true,
        due: false,
        confidence: 'maybe',
        reasons: [
          `Awake in the night since ${formatTime(lastWoke ?? now)}.`,
          'Night wakings are usually short; this is a rough guess.',
        ],
      });
    }
  }

  // Feeds by day ----------------------------------------------------------------------------
  const duringNap = (ms: number) => naps.find((n) => ms > n.start && ms < n.end);
  if (lastFeed != null && !nightStarted) {
    let next = lastFeed + p.feedGap.median;
    let from = lastFeed;
    let step = 1;
    while (next < bedtime && step < 12) {
      let at = Math.max(next, now);
      const nap = duringNap(at);
      const moved = nap != null;
      if (nap) at = nap.end;
      if (at >= bedtime) break;
      add({
        kind: 'feed',
        at,
        ...window(at, p.feedGap.spread, step),
        endAt: null,
        night: false,
        due: next <= now,
        confidence:
          step <= 2 && consistent(p.feedGap, 0.35 * p.feedGap.median) ? 'likely' : 'maybe',
        reasons: [
          step === 1
            ? `Last fed at ${formatTime(from)}.`
            : `Follows the feed expected at ${formatTime(from)}.`,
          p.feedGap.personal
            ? `Feeds about every ${formatDuration(p.feedGap.median)} by day lately (${examples(p.feedGap, 'gaps between feeds')}).`
            : `Babies at ${ageLabel(ageDays)} often feed about every ${formatDuration(p.feedGap.median)}.`,
          ...(moved ? ['Falls during a nap, so moved to when they wake.'] : []),
          ...(next <= now ? ['Already due by their usual rhythm.'] : []),
        ],
      });
      from = at;
      next = at + p.feedGap.median;
      step++;
    }
  }

  // The night: feeds and the morning wake-up --------------------------------
  const feedsTonight = feeds.filter((f) => f > bedtime + 20 * MINUTE).length;
  const plannedNightFeeds = Math.max(0, Math.round(p.nightFeedCount.median) - feedsTonight);
  const nightFeedsSure = consistent(p.nightFeedCount, 0.5) && consistent(p.nightStretch, HOUR);
  const nightFeedTimes: number[] = [];
  {
    const lastNightFeed = feedsTonight > 0 ? lastFeed : null;
    let next =
      lastNightFeed != null
        ? lastNightFeed + p.nightFeedGap.median
        : bedtime + p.nightStretch.median;
    for (let i = 0; i < plannedNightFeeds; i++) {
      const at = Math.max(next, now);
      if (at > wakeAt - 45 * MINUTE) break;
      const first = i === 0 && lastNightFeed == null;
      add({
        kind: 'feed',
        at,
        ...window(at, first ? p.nightStretch.spread : p.nightFeedGap.spread, i + 1),
        endAt: null,
        night: true,
        due: next <= now,
        confidence: i === 0 && nightFeedsSure ? 'likely' : 'maybe',
        reasons: [
          p.nightFeedCount.personal
            ? `Usually ${Math.round(p.nightFeedCount.median)} night ${Math.round(p.nightFeedCount.median) === 1 ? 'feed' : 'feeds'} (${examples(p.nightFeedCount, 'nights')}).`
            : `Babies at ${ageLabel(ageDays)} often wake to feed at night.`,
          first
            ? `First stretch after bedtime is about ${formatDuration(p.nightStretch.median)}.`
            : `About ${formatDuration(p.nightFeedGap.median)} between night feeds.`,
        ],
      });
      nightFeedTimes.push(at);
      next = at + p.nightFeedGap.median;
    }
  }
  wakeAt = Math.max(wakeAt, (nightFeedTimes.at(-1) ?? 0) + HOUR, now + 5 * MINUTE);
  add({
    kind: 'wake',
    at: wakeAt,
    ...window(wakeAt, p.morningWake.spread * MINUTE, 1),
    endAt: null,
    night: false,
    due: false,
    confidence: consistent(p.morningWake, 45) ? 'likely' : 'maybe',
    reasons: [
      p.morningWake.personal
        ? `Mornings have started around ${formatTime(atClock(morningDay, p.morningWake.median))} (${examples(p.morningWake, 'mornings')}).`
        : 'Not enough mornings logged yet; 7 AM is a placeholder.',
    ],
  });
  if (lastFeed != null) {
    const at = wakeAt + p.morningFeedDelay.median;
    add({
      kind: 'feed',
      at,
      ...window(at, p.morningFeedDelay.spread, 2),
      endAt: null,
      night: false,
      due: false,
      confidence:
        consistent(p.morningWake, 45) && consistent(p.morningFeedDelay, 20 * MINUTE)
          ? 'likely'
          : 'maybe',
      reasons: [
        p.morningFeedDelay.personal
          ? `The first feed usually comes about ${formatDuration(p.morningFeedDelay.median)} after waking.`
          : 'Most babies feed soon after waking.',
      ],
    });
  }

  // Diapers -----------------------------------------------------------------------------------
  // Dirty ones first: they can be far apart, so one due overnight is shown for the morning.
  const dirtyTimes: number[] = [];
  if (lastDirty != null && now - lastDirty < DIRTY_RECENT) {
    const gap = p.dirtyGap;
    let next = lastDirty + gap.median;
    let from = lastDirty;
    let step = 1;
    while (step < 12) {
      let at = Math.max(next, now);
      let morning = false;
      if (!nightStarted && at < bedtime) {
        const nap = duringNap(at);
        if (nap) at = nap.end + 5 * MINUTE;
      }
      if (nightStarted || at >= bedtime) {
        if (at > wakeAt + 30 * MINUTE) break;
        at = Math.max(at, wakeAt + 30 * MINUTE);
        morning = true;
      }
      add({
        kind: 'dirty-diaper',
        at,
        ...window(at, gap.spread, step),
        endAt: null,
        night: false,
        due: next <= now && !morning,
        confidence: step === 1 && consistent(gap, 0.5 * gap.median) ? 'likely' : 'maybe',
        reasons: [
          step === 1
            ? `Last dirty diaper: ${formatDayTime(from, now)}.`
            : `Follows the dirty diaper expected at ${formatTime(from)}.`,
          gap.personal
            ? `Dirty diapers about every ${formatDuration(gap.median)} lately (${examples(gap, 'gaps between dirty diapers')}).`
            : 'Not enough dirty diapers logged yet. They vary a lot from baby to baby, so this is a rough guess.',
          ...(morning && next < wakeAt ? ['Would fall overnight, so shown for the morning.'] : []),
          ...(next <= now ? ['Already due by their usual rhythm.'] : []),
        ],
      });
      dirtyTimes.push(at);
      if (morning) break;
      from = at;
      next = at + gap.median;
      step++;
    }
  }
  // A wet change expected right around a dirty one is that same change.
  const sameAsDirty = (at: number) => dirtyTimes.some((d) => Math.abs(d - at) < SAME_CHANGE);

  if (diapers === 'all' && lastDiaper != null && !nightStarted) {
    let next = lastDiaper + p.wetGap.median;
    let from = lastDiaper;
    let step = 1;
    while (next < bedtime && step < 12) {
      let at = Math.max(next, now);
      const nap = duringNap(at);
      if (nap) at = nap.end + 5 * MINUTE;
      if (at >= bedtime) break;
      if (!sameAsDirty(at)) {
        add({
          kind: 'wet-diaper',
          at,
          ...window(at, p.wetGap.spread, step),
          endAt: null,
          night: false,
          due: next <= now,
          confidence:
            step <= 2 && consistent(p.wetGap, 0.35 * p.wetGap.median) ? 'likely' : 'maybe',
          reasons: [
            step === 1
              ? `Last change at ${formatTime(from)}.`
              : `Follows the change expected at ${formatTime(from)}.`,
            p.wetGap.personal
              ? `Wet changes about every ${formatDuration(p.wetGap.median)} by day lately (${examples(p.wetGap, 'gaps before a wet change')}).`
              : `A change every ${formatDuration(p.wetGap.median)} or so is common at this age.`,
          ],
        });
      }
      from = at;
      next = at + p.wetGap.median;
      step++;
    }
  }

  if (diapers === 'all') {
    const nightDiapers = Math.round(p.nightDiaperCount.median);
    nightFeedTimes.slice(0, nightDiapers).forEach((feedAt) => {
      const at = feedAt + 10 * MINUTE;
      add({
        kind: 'wet-diaper',
        at,
        ...window(at, 20 * MINUTE, 1),
        endAt: null,
        night: true,
        due: false,
        confidence: 'maybe',
        reasons: [
          `Night feeds have usually come with a change (${examples(p.nightDiaperCount, 'nights')}).`,
        ],
      });
    });
  }

  items.sort((a, b) => a.at - b.at);
  // Ids by kind and order ("feed-0", "feed-1"…), so an item keeps its id as the minutes pass
  // and its estimate moves.
  const seen = new Map<string, number>();
  for (const item of items) {
    const key = `${item.kind}${item.night ? '-night' : ''}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    item.id = `${key}-${n}`;
  }
  return {
    now,
    asleepSince: running?.startAt ?? null,
    awakeSince: running ? null : lastWoke,
    learning,
    daysOfData: p.daysOfData,
    items,
  };
}

/** Today's logged entries so far, for the "Earlier" summary. */
export function earlierToday(events: BabyEvent[], now: number) {
  const today = startOfLocalDay(now);
  const todays = events.filter((e) => e.startAt >= today && e.startAt <= now);
  return {
    events: todays,
    sleeps: todays.filter((e) => e.type === 'sleep').length,
    feeds: feedSessions(todays).length,
    diapers: todays.filter((e) => e.type === 'diaper').length,
  };
}

/** How far back to load entries. */
export function oracleLookbackStart(now: number): number {
  return addLocalDays(startOfLocalDay(now), -ORACLE_LOOKBACK_DAYS) - DAY;
}
