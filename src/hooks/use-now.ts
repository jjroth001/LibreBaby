import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time in ms, refreshed every `intervalMs` and whenever the app returns to the foreground. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
