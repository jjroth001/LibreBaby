import { BackgroundSync } from '@modules/background-sync/src';
import { getRandomBytes, randomUUID } from 'expo-crypto';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/db/use-settings';
import { isInstalledBuild } from '@/lib/platform';

import { clearFamily, getFamily, saveFamily, type Family } from './identity';
import type { SyncEvent } from './manager';
import { adoptFamilyChild, newFamily, type Invite } from './pairing';
import { syncService } from './sync-service';

type SyncContextValue = {
  /** Networking needs native modules that only exist in installed builds. */
  supported: boolean;
  /** undefined while loading from secure storage. */
  family: Family | null | undefined;
  syncing: boolean;
  lastEvent: SyncEvent | null;
  syncNow(): void;
  setUp(): Promise<void>;
  join(invite: Invite): Promise<void>;
  leave(): Promise<void>;
  /** A new family code; phones with the old one can no longer sync with this one. */
  resetCode(): Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}

/** Wait this long after a local change before syncing, so a burst of edits goes together. */
const CHANGE_DEBOUNCE_MS = 4_000;
/** Writes made by a sync itself also fire change events; ignore those. */
const QUIET_AFTER_SYNC_MS = 3_000;

/**
 * Family sync for the app's screens: loads the family from secure storage, keeps the shared
 * sync engine running while the app is open — and, with background sync on, after it's
 * closed too (via the background-sync service) — and syncs shortly after local changes.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const settings = useSettings();
  const [family, setFamily] = useState<Family | null | undefined>(undefined);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [syncing, setSyncing] = useState(syncService.syncing);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(syncService.lastEvent);
  const background = settings.data?.backgroundSync ?? true;
  const settingsLoaded = settings.status === 'success';

  useEffect(() => {
    getFamily()
      .then(setFamily)
      .catch(() => setFamily(null));
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    const unsubscribe = syncService.subscribe((event) => {
      setSyncing(syncService.syncing);
      if (event.type !== 'syncing') setLastEvent(event);
    });
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);

  // Open app: always sync. Closed app: keep going only with background sync on, where the
  // service keeps the process (and this engine) alive.
  useEffect(() => {
    if (!isInstalledBuild || family === undefined || !settingsLoaded) return;
    const service = BackgroundSync;
    const keepInBackground = background && service != null;
    if (!family) {
      service?.stop();
      void syncService.stop();
      return;
    }
    if (active) {
      void syncService.ensureRunning();
      // Can only be started while the app is in the foreground.
      if (keepInBackground) service.start();
      else service?.stop();
    } else if (!keepInBackground) {
      void syncService.stop();
    }
  }, [family, active, background, settingsLoaded]);

  // Sync a few seconds after something changes here.
  useEffect(() => {
    if (!isInstalledBuild || !family) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSyncEnd = 0;
    const unsubscribe = syncService.subscribe((event) => {
      if (event.type !== 'syncing') lastSyncEnd = Date.now();
    });
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (tableName !== 'event' && tableName !== 'child') return;
      if (syncService.syncing || Date.now() - lastSyncEnd < QUIET_AFTER_SYNC_MS) return;
      clearTimeout(timer);
      timer = setTimeout(() => syncService.syncNow(), CHANGE_DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
      unsubscribe();
    };
  }, [family]);

  const syncNow = useCallback(() => syncService.syncNow(), []);

  const setUp = useCallback(async () => {
    const created = newFamily(getRandomBytes, randomUUID);
    await saveFamily(created);
    setFamily(created);
  }, []);

  const join = useCallback(
    async (invite: Invite) => {
      await adoptFamilyChild(db, invite);
      const joined = { familyId: invite.familyId, keyHex: invite.keyHex };
      await saveFamily(joined);
      setFamily(joined);
    },
    [db],
  );

  const leave = useCallback(async () => {
    BackgroundSync?.stop();
    await clearFamily();
    await syncService.stop();
    await db.runAsync('DELETE FROM sync_peer');
    setFamily(null);
  }, [db]);

  const resetCode = useCallback(async () => {
    const created = newFamily(getRandomBytes, randomUUID);
    await saveFamily(created);
    // The phones listed belonged to the old code; they reappear once they scan the new one.
    await db.runAsync('DELETE FROM sync_peer');
    setFamily(created);
    // Already running for the old family: restart with the new key.
    if (isInstalledBuild) await syncService.ensureRunning();
  }, [db]);

  return (
    <SyncContext.Provider
      value={{
        supported: isInstalledBuild,
        family,
        syncing,
        lastEvent,
        syncNow,
        setUp,
        join,
        leave,
        resetCode,
      }}>
      {children}
    </SyncContext.Provider>
  );
}
