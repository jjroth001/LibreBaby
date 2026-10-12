import { requireOptionalNativeModule } from 'expo';

type LiveTimerModule = {
  show(key: string, title: string, text: string, startAt: number, running: boolean): void;
  hide(key: string): void;
  scheduleWidgetRefresh(minutes: number): void;
};

/**
 * Native helpers for running-timer notifications and widget refreshes (Android, installed
 * builds). null in Expo Go, which doesn't include this module.
 */
export const LiveTimer = requireOptionalNativeModule<LiveTimerModule>('LiveTimer');
