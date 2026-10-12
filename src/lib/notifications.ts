import Constants, { ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'sleep-window';
const REMINDER_ID = 'sleep-window-reminder';

/**
 * Expo Go on Android raises an error as soon as expo-notifications is loaded (push
 * support was removed there in SDK 53), so reminders only run in a real build of the
 * app. The module is loaded lazily so Expo Go never touches it.
 */
export const remindersSupported =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let loaded: Promise<NotificationsModule> | null = null;

function notifications(): Promise<NotificationsModule> {
  loaded ??= import('expo-notifications').then((Notifications) => {
    // Show reminders even while the app is open.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return Notifications;
  });
  return loaded;
}

async function ensureChannel(Notifications: NotificationsModule) {
  // Android 13+ won't show the permission prompt until a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Sleep window reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Asks for notification permission if needed. Returns whether we may notify. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const Notifications = await notifications();
  await ensureChannel(Notifications);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export type Reminder = { at: number; title: string; body: string };

// Reschedules run one at a time so a quick burst of changes can't leave a stale reminder behind.
let queue: Promise<unknown> = Promise.resolve();

/** Replaces the pending sleep reminder with `reminder`, or just cancels it when null. */
export function syncSleepReminder(reminder: Reminder | null): Promise<void> {
  if (!remindersSupported) return Promise.resolve();
  const next = queue.then(async () => {
    const Notifications = await notifications();
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    if (!reminder || reminder.at <= Date.now()) return;
    await ensureChannel(Notifications);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: CHANNEL_ID,
      },
    });
  });
  queue = next.catch(() => {});
  return next;
}
