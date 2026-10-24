import type { SQLiteDatabase } from 'expo-sqlite';

import { getChild } from '@/db/children';
import { getLatestEvent, listEvents, listRunningTimers } from '@/db/events';
import { getSettings } from '@/db/settings';
import { loadRecentSleeps, sleepStateFrom } from '@/db/sleep-state';
import { ageInDays } from '@/lib/dates';
import { buildForecast, oracleLookbackStart } from '@/lib/oracle';
import { sceneFor } from '@/lib/sky';

import {
  buildFedModel,
  buildSleepTileModel,
  buildUpNextModel,
  type FedModel,
  type SleepTileModel,
  type UpNextModel,
} from './extra-models';
import { buildWidgetModel, WIDGET_NAMES, type WidgetModel } from './widget-model';

const FEED_TYPES = ['feed_breast', 'feed_bottle', 'feed_solids'] as const;

/** Reads everything the main widget shows. Used by the app and by the widget's background task. */
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

/** The Oracle's next few estimates, worked out just as on the Oracle tab. */
export async function loadUpNextModel(db: SQLiteDatabase, now: number): Promise<UpNextModel> {
  const [child, settings] = await Promise.all([getChild(db), getSettings(db)]);
  const scene = sceneFor(now, settings.appearance, settings.skyLocation);
  if (!child) return buildUpNextModel(scene, null, null);
  const events = await listEvents(db, child.id, oracleLookbackStart(now), now + 1);
  const forecast = buildForecast({
    events: events.filter((e) => e.startAt <= now),
    ageDays: ageInDays(child.birthDate, new Date(now)),
    now,
    diapers: settings.oracleDiapers,
  });
  return buildUpNextModel(scene, child.name, forecast);
}

export async function loadFedModel(db: SQLiteDatabase, now: number): Promise<FedModel> {
  const [child, settings] = await Promise.all([getChild(db), getSettings(db)]);
  const scene = sceneFor(now, settings.appearance, settings.skyLocation);
  if (!child)
    return buildFedModel({
      scene,
      hasChild: false,
      lastFeed: null,
      lastBreast: null,
      breastfeeding: false,
      now,
    });
  const [lastFeed, lastBreast, timers] = await Promise.all([
    getLatestEvent(db, child.id, FEED_TYPES),
    getLatestEvent(db, child.id, ['feed_breast']),
    listRunningTimers(db, child.id),
  ]);
  return buildFedModel({
    scene,
    hasChild: true,
    lastFeed,
    lastBreast,
    breastfeeding: timers.some((t) => t.type === 'feed_breast'),
    now,
  });
}

export async function loadSleepTileModel(db: SQLiteDatabase, now: number): Promise<SleepTileModel> {
  const [child, settings] = await Promise.all([getChild(db), getSettings(db)]);
  const scene = sceneFor(now, settings.appearance, settings.skyLocation);
  if (!child) return buildSleepTileModel(scene, false, { status: 'no-data' }, now);
  const sleeps = await loadRecentSleeps(db, child.id, now);
  return buildSleepTileModel(scene, true, sleepStateFrom(child, sleeps), now);
}

export type AnyWidgetModel =
  | { name: typeof WIDGET_NAMES.main; model: WidgetModel }
  | { name: typeof WIDGET_NAMES.upNext; model: UpNextModel }
  | { name: typeof WIDGET_NAMES.fed; model: FedModel }
  | { name: typeof WIDGET_NAMES.sleep; model: SleepTileModel };

/** The model for the widget Android asked about, by its name in app.json. */
export async function loadModelFor(
  db: SQLiteDatabase,
  name: string,
  now: number,
): Promise<AnyWidgetModel> {
  switch (name) {
    case WIDGET_NAMES.upNext:
      return { name, model: await loadUpNextModel(db, now) };
    case WIDGET_NAMES.fed:
      return { name, model: await loadFedModel(db, now) };
    case WIDGET_NAMES.sleep:
      return { name, model: await loadSleepTileModel(db, now) };
    default:
      return { name: WIDGET_NAMES.main, model: await loadWidgetModel(db, now) };
  }
}

/** Minutes between widget redraws: every minute while a timer runs, else every 10. */
export async function loadRefreshMinutes(db: SQLiteDatabase): Promise<number> {
  const child = await getChild(db);
  if (!child) return 10;
  return (await listRunningTimers(db, child.id)).length > 0 ? 1 : 10;
}
