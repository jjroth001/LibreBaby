import type { BabyEvent } from '@/db/types';

import { formatDuration } from './format';
import { formatVolume, type VolumeUnit } from './units';

export function eventEmoji(event: BabyEvent): string {
  switch (event.type) {
    case 'sleep':
      return '😴';
    case 'feed_breast':
      return '🤱';
    case 'feed_bottle':
      return '🍼';
    case 'feed_solids':
      return '🥣';
    case 'diaper':
      return event.data.dirty ? '💩' : '💧';
  }
}

/** Short human label for an event, e.g. "Bottle · 4 oz formula", "Wet + dirty diaper". */
export function describeEvent(event: BabyEvent, unit: VolumeUnit): string {
  switch (event.type) {
    case 'sleep':
      return event.endAt ? `Slept ${formatDuration(event.endAt - event.startAt)}` : 'Sleeping';
    case 'feed_breast': {
      const { leftMs, rightMs } = event.data;
      const parts = [
        leftMs > 0 && `L ${formatDuration(leftMs)}`,
        rightMs > 0 && `R ${formatDuration(rightMs)}`,
      ];
      const sides = parts.filter(Boolean).join(', ');
      return sides ? `Breast · ${sides}` : 'Breast';
    }
    case 'feed_bottle': {
      const content = event.data.content === 'formula' ? 'formula' : 'breast milk';
      return `Bottle · ${formatVolume(event.data.amountMl, unit)} ${content}`;
    }
    case 'feed_solids':
      return event.data.foods.length ? `Solids · ${event.data.foods.join(', ')}` : 'Solids';
    case 'diaper': {
      const { wet, dirty } = event.data;
      return wet && dirty ? 'Wet + dirty diaper' : dirty ? 'Dirty diaper' : 'Wet diaper';
    }
  }
}
