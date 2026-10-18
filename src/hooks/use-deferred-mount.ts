import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

/** When this module loaded: about when the app started. */
const appStart = Date.now();

/**
 * For heavier tabs off to the side: all tabs are built when the app opens, so building
 * these a moment later lets Home appear and respond first. Ready right away if the tab is
 * in view (or once `delayMs` has passed since the app started), and stays ready.
 */
export function useDeferredMount(delayMs: number): boolean {
  const focused = useIsFocused();
  const [waited, setWaited] = useState(() => Date.now() - appStart >= delayMs);

  useEffect(() => {
    if (waited) return;
    const timer = setTimeout(() => setWaited(true), Math.max(0, appStart + delayMs - Date.now()));
    return () => clearTimeout(timer);
  }, [waited, delayMs]);

  // Once shown, stay built (adjusting state while rendering, as React recommends).
  if (focused && !waited) setWaited(true);

  return waited || focused;
}
