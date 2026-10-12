import { syncService } from './sync-service';

/**
 * Runs in the background-sync foreground service (headless when the app is closed, e.g.
 * after a reboot). Keeps the sync engine running until it's stopped; if the app already
 * started it, this just keeps it company.
 */
export async function backgroundSyncTask(): Promise<void> {
  await syncService.ensureRunning();
  await syncService.untilStopped();
}
