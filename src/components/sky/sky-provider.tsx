import { BlurTargetView } from 'expo-blur';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { paletteFor, simplePalette, type Palette } from '@/constants/theme';
import { setSetting } from '@/db/settings';
import { useSettings } from '@/db/use-settings';
import { useNow } from '@/hooks/use-now';
import { setHapticsEnabled } from '@/lib/haptics';
import { refreshSkyLocation } from '@/lib/location';
import { SCENES, sceneFor, type Scene } from '@/lib/sky';

import { SkyBackground } from './sky-background';

type SkyValue = {
  scene: Scene;
  /** Increase contrast: glass panels more opaque. */
  contrast: boolean;
  /** The view glass panels blur (the sky). */
  blurTarget: RefObject<View | null>;
  /** Settings have loaded, so the sky won't jump from the default to the user's choice. */
  ready: boolean;
};

const night = SCENES.night;
const SkyContext = createContext<SkyValue>({
  scene: night,
  contrast: false,
  blurTarget: { current: null },
  ready: false,
});
// Separate, so text-colored UI doesn't re-render with every minute's sky change.
const PaletteContext = createContext<Palette>(
  paletteFor(night.text, night.textMuted, night.accent),
);

/** The current sky scene; changes every minute. */
export const useSky = () => use(SkyContext);
/** UI colors for the current sky; changes only when the text colors flip. */
export const usePalette = () => use(PaletteContext);

/**
 * Draws the time-of-day sky behind the whole app (or, in the Simple look, a plain
 * background) and provides the matching colors. Also applies the app-wide accessibility
 * preferences: reduced motion and vibration. The sky
 * updates every minute; by default it follows typical sunrise/sunset times, or the real
 * ones once the user shares an approximate location.
 */
export function SkyProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const settings = useSettings();
  const now = useNow(60_000);
  const blurTarget = useRef<View>(null);

  const systemScheme = useColorScheme();
  const appearance = settings.data?.appearance ?? 'sky';
  const location = settings.data?.skyLocation ?? null;
  const contrast = settings.data?.highContrast ?? false;
  const reduceMotion = settings.data?.reduceMotion ?? false;
  const haptics = settings.data?.haptics ?? true;
  const simple = appearance === 'simple';
  const scene = sceneFor(now, appearance, location);
  // Built from strings and flags only, so screens re-render when the text colors flip,
  // not every minute.
  const palette = simple
    ? simplePalette(systemScheme === 'dark', contrast)
    : paletteFor(scene.text, scene.textMuted, scene.accent, contrast);

  useEffect(() => setHapticsEnabled(haptics), [haptics]);

  // Keep the location roughly current (e.g. after travel), without ever prompting.
  useEffect(() => {
    if (!location) return;
    refreshSkyLocation(location)
      .then((fresh) => fresh && setSetting(db, 'skyLocation', fresh))
      .catch(() => {});
  }, [db, location]);

  return (
    <SkyContext value={{ scene, blurTarget, contrast, ready: settings.status !== 'loading' }}>
      <PaletteContext value={palette}>
        {/* Animations everywhere follow Android's setting, or are always off if asked. */}
        <ReducedMotionConfig mode={reduceMotion ? ReduceMotion.Always : ReduceMotion.System} />
        <View style={[styles.fill, simple && { backgroundColor: palette.background }]}>
          {!simple && (
            <BlurTargetView ref={blurTarget} style={StyleSheet.absoluteFill}>
              <SkyBackground scene={scene} />
            </BlurTargetView>
          )}
          {children}
        </View>
      </PaletteContext>
    </SkyContext>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
