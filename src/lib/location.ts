import * as Location from 'expo-location';

import type { SkyLocation } from '@/db/settings';

/** Re-read the location this often (it only moves sunrise by minutes unless you travel). */
export const SKY_LOCATION_MAX_AGE_MS = 7 * 86_400_000;

/** One decimal place ≈ 11 km: plenty for sunrise times, too coarse to locate a home. */
export const roundCoordinate = (value: number) => Math.round(value * 10) / 10;

async function readPosition(): Promise<SkyLocation | null> {
  const position =
    (await Location.getLastKnownPositionAsync({
      maxAge: SKY_LOCATION_MAX_AGE_MS,
    })) ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
    }));
  if (!position) return null;
  return {
    lat: roundCoordinate(position.coords.latitude),
    lon: roundCoordinate(position.coords.longitude),
    updatedAt: Date.now(),
  };
}

/**
 * Asks for (approximate) location permission and reads a rounded position. Returns null when
 * the user declines or no position is available.
 */
export async function requestSkyLocation(): Promise<SkyLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return readPosition();
}

/** A fresh reading when the stored one is stale, without ever prompting; null otherwise. */
export async function refreshSkyLocation(current: SkyLocation): Promise<SkyLocation | null> {
  if (Date.now() - current.updatedAt < SKY_LOCATION_MAX_AGE_MS) return null;
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  return readPosition();
}
