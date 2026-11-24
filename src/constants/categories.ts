import type { BabyEvent } from '@/db/types';

import type { Palette } from './theme';

/** The kinds of entry that get their own color everywhere in the app. */
export type Category = 'sleep' | 'feed' | 'diaper' | 'meds';

/** A category's colors: `bar` for icons, lines and chart bars; `fill` for soft backgrounds. */
export type CategoryColors = { bar: string; fill: string };

/**
 * Like calendars in a calendar app: purple for sleep, orange for feeds, teal for diapers,
 * pink for medicine. Deep shades where text is dark (the day sky, Simple light), light ones
 * where it's white. Each `bar` stays ≥3:1 on its own `fill` (see theme.test.ts).
 */
export function categoryColors(theme: Palette, category: Category): CategoryColors {
  if (theme.light) {
    const bar = { sleep: '#5646C2', feed: '#B45309', diaper: '#0F766E', meds: '#A3246A' }[category];
    const fill = theme.simple
      ? { sleep: '#ECE9FF', feed: '#FDEBDB', diaper: '#DDF3EF', meds: '#FBE6F0' }[category]
      : {
          sleep: 'rgba(86,70,194,0.16)',
          feed: 'rgba(180,83,9,0.16)',
          diaper: 'rgba(15,118,110,0.16)',
          meds: 'rgba(163,36,106,0.14)',
        }[category];
    return { bar, fill };
  }
  const bar = { sleep: '#B9B0FF', feed: '#FFC08A', diaper: '#8FE0D8', meds: '#F5A8CB' }[category];
  const fill = {
    sleep: 'rgba(185,176,255,0.2)',
    feed: 'rgba(255,192,138,0.18)',
    diaper: 'rgba(143,224,216,0.16)',
    meds: 'rgba(245,168,203,0.18)',
  }[category];
  return { bar, fill };
}

/** Which category an entry belongs to; null for growth, milestones and unknown types. */
export function eventCategory(event: BabyEvent): Category | null {
  switch (event.type) {
    case 'sleep':
      return 'sleep';
    case 'feed_breast':
    case 'feed_bottle':
    case 'feed_solids':
    case 'pump':
      return 'feed';
    case 'diaper':
      return 'diaper';
    case 'medication':
      return 'meds';
    default:
      return null;
  }
}
