import type { SQLiteDatabase } from 'expo-sqlite';

import { getChild } from '@/db/children';
import { getLatestEvent, listRunningTimers } from '@/db/events';
import { getSettings } from '@/db/settings';
import { loadRecentSleeps, sleepStateFrom } from '@/db/sleep-state';
import { sceneFor } from '@/lib/sky';

import { buildWidgetModel, type WidgetModel } from './widget-model';

const FEED_TYPES = ['feed_breast', 'feed_bottle', 'feed_solids'] as const;

/** Reads everything the widget shows. Used by the app and by the widget's background task. */
export async function loadWidgetModel(db: SQLiteDatabase, now: number): Promise<WidgetModel> {
  const [child, settings] = await Promise.all([getChild(db), getSettings(db)]);
  const scene = sceneFor(now, settings.appearance, settings.skyLocation);
  if (!child) return { kind: 'empty', scene };

  const [lastFeed, lastDiaper, sleeps, timers] = await Promise.all([
    getLatestEvent(db, child.id, FEED_TYPES),
    getLatestEvent(db, child.id, ['diaper']),
    loadRecentSleeps(db, child.id, now),
    listRunningTimers(db, child.id),
  ]);

  return buildWidgetModel({
    child,
    lastFeed,
    lastDiaper,
    sleep: sleepStateFrom(child, sleeps),
    timers,
    unit: settings.volumeUnit,
    growthUnits: settings.growthUnits,
    now,
    scene,
  });
}
