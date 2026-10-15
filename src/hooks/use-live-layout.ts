import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { Motion } from '@/constants/motion';

/**
 * Layout animations for a list that can change while nobody is looking at it (a sleep
 * ended from the widget or another family phone, the screen locked, another tab open).
 * A layout transition started then can strand views at their old offsets: rows drawn on
 * top of each other, or a gap pushing cards under the tab bar.
 *
 * `layout` is the glide preset only while the screen is focused and the app is in front.
 * `resetKey` changes each time the screen comes back into view; key a
 * `<LayoutAnimationConfig skipEntering skipExiting>` around the animated views with it, so
 * any view left mid-transition is rebuilt in place, without replaying its fade.
 */
export function useLiveLayout() {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [resetKey, setResetKey] = useState(0);
  const visible = focused && active;
  const wasVisible = useRef(visible);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (visible && !wasVisible.current) setResetKey((key) => key + 1);
    wasVisible.current = visible;
  }, [visible]);

  return { layout: visible ? Motion.layout : undefined, resetKey };
}
