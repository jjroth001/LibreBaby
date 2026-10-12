import type { BabyEvent } from '@/db/types';

import type { IconName } from './icon';

/** The icon that stands for an entry in lists. */
export function eventIcon(event: BabyEvent): IconName {
  switch (event.type) {
    case 'sleep':
      return 'moon-stars';
    case 'feed_breast':
      return 'breast';
    case 'feed_bottle':
      return 'bottle';
    case 'feed_solids':
      return 'bowl-food';
    case 'diaper':
      return event.data.dirty ? 'diaper-dirty' : 'drop';
    case 'medication':
      return 'pill';
    case 'pump':
      return 'pump';
    case 'growth':
      return 'ruler';
  }
}
