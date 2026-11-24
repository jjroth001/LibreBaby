import { requireOptionalNativeModule } from 'expo';

type BackgroundSyncModule = {
  start(): void;
  stop(): void;
  holdAwake(ms: number): void;
  release(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  /** This phone's addresses and their interface names ("tun0" for a VPN such as Tailscale). */
  networkAddresses(): { name: string; address: string }[];
};

/**
 * Keeps family sync running while the app is closed (Android foreground service running the
 * `LibreBabySync` headless task). null in Expo Go.
 */
export const BackgroundSync = requireOptionalNativeModule<BackgroundSyncModule>('BackgroundSync');

/** Must match SYNC_TASK_KEY in SyncForegroundService.kt. */
export const SYNC_TASK_KEY = 'LibreBabySync';
