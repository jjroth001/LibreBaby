import type { IconName } from '@/components/icons/icon';
import { categoryColors, type CategoryColors } from '@/constants/categories';
import type { Palette } from '@/constants/theme';
import { formatDuration, formatTime, formatTimeRange } from '@/lib/format';
import type { OracleItem, OracleKind } from '@/lib/oracle';

type Category = 'sleep' | 'feed' | 'diaper';

const CATEGORY: Record<OracleKind, Category> = {
  nap: 'sleep',
  'nap-end': 'sleep',
  bedtime: 'sleep',
  'back-to-sleep': 'sleep',
  wake: 'sleep',
  feed: 'feed',
  'wet-diaper': 'diaper',
  'dirty-diaper': 'diaper',
};

const ICON: Record<OracleKind, IconName> = {
  nap: 'moon',
  'nap-end': 'sun',
  bedtime: 'moon-stars',
  'back-to-sleep': 'moon-stars',
  wake: 'sun',
  feed: 'bottle',
  'wet-diaper': 'drop',
  'dirty-diaper': 'diaper-dirty',
};

export function itemIcon(item: OracleItem): IconName {
  return ICON[item.kind];
}

/** Agenda colors: the app's category colors (see constants/categories.ts). */
export function categoryColor(theme: Palette, item: OracleItem): CategoryColors {
  return categoryColors(theme, CATEGORY[item.kind]);
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
  'wet-diaper': 'Wet diaper',
  'dirty-diaper': 'Dirty diaper',
};

export function itemName(item: OracleItem): string {
  if (item.kind === 'nap' && item.endAt != null && item.endAt - item.at < 30 * 60_000) {
    return 'Catnap';
  }
  if (item.kind === 'feed' && item.night) return 'Night feed';
  return NAMES[item.kind];
}

/** The agenda's time column: "~4:50 PM", or "Now" once it's due. */
export function itemTime(item: OracleItem): string {
  return item.due ? 'Now' : `~${formatTime(item.at)}`;
}

/** For screen readers: "Feed around 4:50 PM", "Feed, due now". */
export function itemTitle(item: OracleItem): string {
  return item.due
    ? `${itemName(item)}, due now`
    : `${itemName(item)} around ${formatTime(item.at)}`;
}

export function windowText(item: OracleItem): string {
  return formatTimeRange(item.from, item.to);
}

/** The second line of an agenda item; diapers stay a single line. */
export function itemSubtitle(item: OracleItem): string | null {
  if (item.kind === 'nap' && item.endAt != null) {
    return `About ${formatDuration(item.endAt - item.at)} · until ${formatTime(item.endAt)}`;
  }
  if (item.kind === 'wet-diaper' || item.kind === 'dirty-diaper') return null;
  return `Window ${windowText(item)}`;
}

/** A spoken summary for screen readers. */
export function itemLabel(item: OracleItem): string {
  const sub = itemSubtitle(item);
  return `${itemTitle(item)}. ${sub ? `${sub}. ` : ''}${item.confidence === 'likely' ? 'Likely' : 'Maybe'}.`;
}
