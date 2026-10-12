import * as Haptics from 'expo-haptics';

/** Light tick for taps that change state (start/stop/switch). */
export function tapFeedback() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Confirmation that something was saved. */
export function successFeedback() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
