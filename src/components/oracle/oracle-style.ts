import type { IconName } from '@/components/icons/icon';
import type { Palette } from '@/constants/theme';
import { formatDuration, formatTime, formatTimeRange } from '@/lib/format';
import type { OracleItem, OracleKind } from '@/lib/oracle';

export type Category = 'sleep' | 'feed' | 'diaper';

const CATEGORY: Record<OracleKind, Category> = {
  nap: 'sleep',
  'nap-end': 'sleep',
  bedtime: 'sleep',
  'back-to-sleep': 'sleep',
  wake: 'sleep',
  feed: 'feed',
  diaper: 'diaper',
};

const ICON: Record<OracleKind, IconName> = {
  nap: 'moon',
  'nap-end': 'sun',
  bedtime: 'moon-stars',
  'back-to-sleep': 'moon-stars',
  wake: 'sun',
  feed: 'bottle',
  diaper: 'drop',
};

export function itemIcon(item: OracleItem): IconName {
  return ICON[item.kind];
}

/**
 * Agenda colors, like calendars on a calendar app: purple for sleep, orange for feeds, teal
 * for diapers. Deep shades where text is dark, light ones where it's white.
 */
export function categoryColor(theme: Palette, item: OracleItem): { bar: string; fill: string } {
  const category = CATEGORY[item.kind];
  if (theme.light) {
    const bar = { sleep: '#5646C2', feed: '#B45309', diaper: '#0F766E' }[category];
    const fill = theme.simple
      ? { sleep: '#ECE9FF', feed: '#FDEBDB', diaper: '#DDF3EF' }[category]
      : {
          sleep: 'rgba(86,70,194,0.16)',
          feed: 'rgba(180,83,9,0.16)',
          diaper: 'rgba(15,118,110,0.16)',
        }[category];
    return { bar, fill };
  }
  const bar = { sleep: '#B9B0FF', feed: '#FFC08A', diaper: '#8FE0D8' }[category];
  const fill = {
    sleep: 'rgba(185,176,255,0.2)',
    feed: 'rgba(255,192,138,0.18)',
    diaper: 'rgba(143,224,216,0.16)',
  }[category];
  return { bar, fill };
}

/** The red-orange "now" line, as on a calendar. */
export function nowColor(theme: Palette): string {
  return theme.light ? '#B8400B' : '#FFB070';
}

const NAMES: Record<OracleKind, string> = {
  nap: 'Nap',
  'nap-end': 'Wakes from nap',
  bedtime: 'Bedtime',
  'back-to-sleep': 'Back to sleep',
  wake: 'Wake up',
  feed: 'Feed',
  diaper: 'Diaper',
};

export function itemName(item: OracleItem): string {
  if (item.kind === 'nap' && item.endAt != null && item.endAt - item.at < 30 * 60_000) {
    return 'Catnap';
  }
  if (item.kind === 'feed' && item.night) return 'Night feed';
  return NAMES[item.kind];
}

export function itemTitle(item: OracleItem): string {
  return item.due ? `${itemName(item)} · due now` : `${itemName(item)} ~${formatTime(item.at)}`;
}

export function windowText(item: OracleItem): string {
  return formatTimeRange(item.from, item.to);
}

/** The second line of an agenda item; diapers stay a single line. */
export function itemSubtitle(item: OracleItem): string | null {
  if (item.kind === 'nap' && item.endAt != null) {
    return `About ${formatDuration(item.endAt - item.at)} · until ~${formatTime(item.endAt)}`;
  }
  if (item.kind === 'diaper') return null;
  return `Window ${windowText(item)}`;
}

/** A spoken summary for screen readers. */
export function itemLabel(item: OracleItem): string {
  const sub = itemSubtitle(item);
  return `${itemTitle(item)}. ${sub ? `${sub}. ` : ''}${item.confidence === 'likely' ? 'Likely' : 'Maybe'}.`;
}
