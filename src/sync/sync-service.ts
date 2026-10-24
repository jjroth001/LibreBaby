import * as Device from 'expo-device';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrateDbIfNeeded } from '@/db/migrations';

import { getDeviceId, getFamily } from './identity';
import type { SyncEvent, SyncManager } from './manager';

type Listener = (event: SyncEvent) => void;

export type SyncAttempt = Exclude<SyncEvent, { type: 'syncing' }> | { type: 'no-phones' };

const deviceName = () => Device.deviceName ?? Device.modelName ?? 'Android phone';

/**
 * The one sync engine for the app process. The open app and the background-sync task both
 * use it, so there's only ever one listener on the network, whichever started first.
 * Native networking is loaded lazily (installed builds only).
 */
class SyncService {
  private manager: SyncManager | null = null;
  private db: SQLiteDatabase | null = null;
  private familyId: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<Listener>();
  private stopped: (() => void)[] = [];
  lastEvent: SyncEvent | null = null;
  syncing = false;

  /** Runs one change at a time, so a quick start/stop/start can't overlap. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }

  /**
   * Its own database connection, kept open for the life of the process: the app's screens
   * close theirs when the app is swiped away, while background sync carries on. Change
   * notifications are app-wide, so screens still update when a sync writes.
   */
  private async connection(): Promise<SQLiteDatabase> {
    if (!this.db) {
      const db = await openDatabaseAsync('librebaby.db', {
        enableChangeListener: true,
        useNewConnection: true,
      });
      // Also brings the schema up to date if this runs first after an app update.
      await migrateDbIfNeeded(db);
      this.db = db;
    }
    return this.db;
  }

  /** Starts syncing for the saved family, if it isn't already running for it. */
  ensureRunning(): Promise<void> {
    return this.serial(async () => {
      const family = await getFamily();
      if (!family) {
        this.stopNow();
        return;
      }
      if (this.manager && this.familyId === family.familyId) return;
      this.stopNow();
      const [{ SyncManager }, deviceId, db] = await Promise.all([
        import('./manager'),
        getDeviceId(),
        this.connection(),
      ]);
      const manager = new SyncManager(db, family, { deviceId, name: deviceName() }, (event) =>
        this.emit(event),
      );
      this.manager = manager;
      this.familyId = family.familyId;
      try {
        await manager.start();
      } catch (error) {
        this.stopNow();
        this.emit({ type: 'error', message: (error as Error).message });
      }
    });
  }

  stop(): Promise<void> {
    return this.serial(async () => this.stopNow());
  }

  private stopNow() {
    this.manager?.stop();
    this.manager = null;
    this.familyId = null;
    this.syncing = false;
    this.stopped.splice(0).forEach((resolve) => resolve());
  }

  get running(): boolean {
    return this.manager !== null;
  }

  syncNow(): void {
    this.manager?.syncNow();
  }

  /**
   * Syncs now and waits for the first outcome (pull to refresh on Home): synced, failed, or
   * no family phone in sight. Gives up after `timeoutMs`.
   */
  syncAndWait(timeoutMs = 10_000): Promise<SyncAttempt> {
    const manager = this.manager;
    if (!manager || manager.visiblePeers === 0) return Promise.resolve({ type: 'no-phones' });
    return new Promise((resolve) => {
      const done = (attempt: SyncAttempt) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(attempt);
      };
      const unsubscribe = this.subscribe((event) => {
        if (event.type !== 'syncing') done(event);
      });
      const timer = setTimeout(
        () => done({ type: 'error', message: 'couldn’t reach the other phone' }),
        timeoutMs,
      );
      manager.syncNow();
    });
  }

  /** Resolves once syncing stops (the background task waits on this). */
  untilStopped(): Promise<void> {
    if (!this.manager) return Promise.resolve();
    return new Promise((resolve) => this.stopped.push(resolve));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEvent) {
    if (event.type === 'syncing') {
      this.syncing = true;
    } else {
      this.syncing = false;
      this.lastEvent = event;
    }
    this.listeners.forEach((listener) => listener(event));
  }
}

export const syncService = new SyncService();
