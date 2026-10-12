import * as Device from 'expo-device';
import { getRandomBytes, randomUUID } from 'expo-crypto';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { isInstalledBuild } from '@/lib/platform';

import { clearFamily, getDeviceId, getFamily, saveFamily, type Family } from './identity';
import type { SyncEvent } from './manager';
import { adoptFamilyChild, newFamily, type Invite } from './pairing';

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

const deviceName = () => Device.deviceName ?? Device.modelName ?? 'Android phone';

/**
 * Owns family sync for the app: loads the family from secure storage, runs the network
 * side while the app is in the foreground, and syncs shortly after local changes.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [family, setFamily] = useState<Family | null | undefined>(undefined);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [syncing, setSyncing] = useState(false);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  const manager = useRef<import('./manager').SyncManager | null>(null);
  const lastSyncEnd = useRef(0);
  const inSync = useRef(false);

  useEffect(() => {
    getFamily()
      .then(setFamily)
      .catch(() => setFamily(null));
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  // Run the network only while the app is open (Android limits background networking).
  useEffect(() => {
    if (!isInstalledBuild || !family || !active) return;
    let cancelled = false;
    let current: import('./manager').SyncManager | null = null;

    (async () => {
      const { SyncManager } = await import('./manager');
      const deviceId = await getDeviceId();
      if (cancelled) return;
      current = new SyncManager(db, family, { deviceId, name: deviceName() }, (event) => {
        if (event.type === 'syncing') {
          inSync.current = true;
          setSyncing(true);
        } else {
          inSync.current = false;
          lastSyncEnd.current = Date.now();
          setSyncing(false);
          setLastEvent(event);
        }
      });
      manager.current = current;
      await current.start();
    })().catch((error: Error) => setLastEvent({ type: 'error', message: error.message }));

    return () => {
      cancelled = true;
      current?.stop();
      manager.current = null;
      setSyncing(false);
    };
  }, [db, family, active]);

  // Sync a few seconds after something changes here.
  useEffect(() => {
    if (!isInstalledBuild || !family) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (tableName !== 'event' && tableName !== 'child') return;
      if (inSync.current || Date.now() - lastSyncEnd.current < QUIET_AFTER_SYNC_MS) return;
      clearTimeout(timer);
      timer = setTimeout(() => manager.current?.syncNow(), CHANGE_DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [family]);

  const syncNow = useCallback(() => manager.current?.syncNow(), []);

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
    await clearFamily();
    await db.runAsync('DELETE FROM sync_peer');
    setFamily(null);
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
      }}>
      {children}
    </SyncContext.Provider>
  );
}
