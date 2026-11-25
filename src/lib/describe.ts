import type { BabyEvent } from '@/db/types';

import { formatDuration } from './format';
import { formatLength, formatWeight, type GrowthUnits } from './growth-units';
import { formatVolume, type VolumeUnit } from './units';

/** Short human label for an event, e.g. "Bottle · 4 oz formula", "Wet + dirty diaper". */
export function describeEvent(
  event: BabyEvent,
  unit: VolumeUnit,
  // Defaults to the system that matches the volume unit; pass it where growth entries show.
  growthUnits: GrowthUnits = unit === 'oz' ? 'imperial' : 'metric',
): string {
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
    case 'medication':
      return event.data.dose ? `${event.data.name} · ${event.data.dose}` : event.data.name;
    case 'pump': {
      const { leftMl, rightMl } = event.data;
      const sides = [
        leftMl > 0 && `L ${formatVolume(leftMl, unit)}`,
        rightMl > 0 && `R ${formatVolume(rightMl, unit)}`,
      ].filter(Boolean);
      const duration = event.endAt ? ` · ${formatDuration(event.endAt - event.startAt)}` : '';
      const detail =
        sides.length === 2 ? ` (${sides.join(', ')})` : sides.length ? ` (${sides[0]})` : '';
      return `Pumped ${formatVolume(leftMl + rightMl, unit)}${detail}${duration}`;
    }
    case 'growth': {
      const { weightKg, lengthCm, headCm } = event.data;
      const parts = [
        weightKg !== null && `Weight ${formatWeight(weightKg, growthUnits)}`,
        lengthCm !== null && `Length ${formatLength(lengthCm, growthUnits)}`,
        headCm !== null && `Head ${formatLength(headCm, growthUnits)}`,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'Measurement';
    }
    case 'milestone':
      return `Milestone · ${event.data.text}`;
    default:
      // An entry type from a newer version of the app (via sync).
      return 'Entry';
  }
}

/**
 * A shorter label for the small tiles on Home, where the full one wraps or gets cut off:
 * "Bottle 4 oz", "Wet + dirty". Breast feeds keep each side on a line of its own
 * ("Breast" / "L 12m, R 9m"), since parents check it to know which side to start on next.
 * Falls back to the full label.
 */
export function describeEventShort(event: BabyEvent, unit: VolumeUnit): string {
  switch (event.type) {
    case 'feed_breast': {
      const { leftMs, rightMs } = event.data;
      const sides = [
        leftMs > 0 && `L ${formatDuration(leftMs)}`,
        rightMs > 0 && `R ${formatDuration(rightMs)}`,
      ].filter(Boolean);
      return sides.length ? `Breast\n${sides.join(', ')}` : 'Breast';
    }
    case 'feed_bottle':
      return `Bottle ${formatVolume(event.data.amountMl, unit)}`;
    case 'feed_solids':
      return 'Solids';
    case 'diaper': {
      const { wet, dirty } = event.data;
      return wet && dirty ? 'Wet + dirty' : dirty ? 'Dirty' : 'Wet';
    }
    case 'pump':
      return `Pumped ${formatVolume(event.data.leftMl + event.data.rightMl, unit)}`;
    default:
      return describeEvent(event, unit);
  }
}
