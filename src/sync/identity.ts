import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';

/**
 * Sync secrets live in the Android Keystore (expo-secure-store), not the database, so
 * they're never copied into backups — restoring a backup on another phone must not
 * clone this phone's identity or family key.
 */

const DEVICE_ID = 'librebaby.sync.deviceId';
const FAMILY = 'librebaby.sync.family';

export type Family = { familyId: string; keyHex: string };

/** This install's id, created on first use. */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID);
  if (existing) return existing;
  const id = randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID, id);
  return id;
}

export async function getFamily(): Promise<Family | null> {
  const raw = await SecureStore.getItemAsync(FAMILY);
  if (!raw) return null;
  try {
    const family = JSON.parse(raw) as Family;
    return family.familyId && /^[0-9a-f]{64}$/.test(family.keyHex) ? family : null;
  } catch {
    return null;
  }
}

export async function saveFamily(family: Family): Promise<void> {
  await SecureStore.setItemAsync(FAMILY, JSON.stringify(family));
}

export async function clearFamily(): Promise<void> {
  await SecureStore.deleteItemAsync(FAMILY);
}
