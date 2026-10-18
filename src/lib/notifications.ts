import { MED_PREFIX, type PlannedReminder } from './med-reminders';
import { isInstalledBuild } from './platform';

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'sleep-window';
const REMINDER_ID = 'sleep-window-reminder';

/**
 * Expo Go on Android raises an error as soon as expo-notifications is loaded (push
 * support was removed there in SDK 53), so reminders only run in a real build of the
 * app. The module is loaded lazily so Expo Go never touches it.
 */
export const remindersSupported = isInstalledBuild;

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

const MED_CHANNEL_ID = 'medicine';
/** Android allows an app ~500 pending alarms; stay far below that. */
const MAX_MED_REMINDERS = 100;

/** What a medicine reminder carries, so a tap can open the log with it filled in. */
export type MedReminderData = { kind: 'medication'; reminderId: string };

let scheduledMed = '';

/** Replaces every pending medicine reminder with `planned` (an empty list cancels them all). */
export function syncMedReminders(planned: PlannedReminder[]): Promise<void> {
  if (!remindersSupported) return Promise.resolve();
  const next = queue.then(async () => {
    const wanted = planned.slice(0, MAX_MED_REMINDERS);
    // Most changes (any new entry, any setting) don't touch these; skip the churn.
    const signature = JSON.stringify(wanted);
    if (signature === scheduledMed) return;
    const Notifications = await notifications();
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of pending) {
      if (request.identifier.startsWith(MED_PREFIX))
        await Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => {});
    }
    scheduledMed = '';
    if (wanted.length > 0) {
      await Notifications.setNotificationChannelAsync(MED_CHANNEL_ID, {
        name: 'Medicine reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    for (const reminder of wanted) {
      if (reminder.at <= Date.now()) continue;
      const data: MedReminderData = {
        kind: 'medication',
        reminderId: reminder.reminderId,
      };
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          channelId: MED_CHANNEL_ID,
        },
      });
    }
    scheduledMed = signature;
  });
  queue = next.catch(() => {});
  return next;
}

/**
 * Calls `onOpen` when a medicine reminder is tapped, including the one that launched the
 * app. Each tap is handled once. Returns an unsubscribe function.
 */
export function onMedReminderTapped(onOpen: (data: MedReminderData) => void): () => void {
  if (!remindersSupported) return () => {};
  let removed = false;
  let remove = () => {};
  const handle = (response: import('expo-notifications').NotificationResponse | null) => {
    if (!response || removed) return;
    const id = response.notification.request.identifier;
    if (handledTaps.has(id + response.notification.date)) return;
    handledTaps.add(id + response.notification.date);
    const data = response.notification.request.content.data;
    if (data?.kind === 'medication') {
      // Reminders scheduled by older versions carry no id; they open an empty log.
      onOpen({
        kind: 'medication',
        reminderId: typeof data.reminderId === 'string' ? data.reminderId : '',
      });
    }
  };
  notifications()
    .then(async (Notifications) => {
      if (removed) return;
      const subscription = Notifications.addNotificationResponseReceivedListener(handle);
      remove = () => subscription.remove();
      handle(await Notifications.getLastNotificationResponseAsync());
      // So a later app start doesn't replay the tap that launched this one.
      await Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => {});
  return () => {
    removed = true;
    remove();
  };
}

const handledTaps = new Set<string>();
