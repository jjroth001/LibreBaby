import * as Haptics from 'expo-haptics';

// Settings › Accessibility › Vibration; set app-wide by SkyProvider.
let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

/** Light tick for taps that change state (start/stop/switch). */
export function tapFeedback() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Confirmation that something was saved. */
export function successFeedback() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
