import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useSky } from '@/components/sky/sky-provider';
import { isLightScene } from '@/lib/sky';

type GlassProps = ViewProps & {
  /** Corner radius; a pill or circle when it's half the height. */
  radius?: number;
  /**
   * Blur the sky behind the panel (the "liquid" look). Off for many small, repeated panels
   * (list rows), where the tint alone reads as glass and saves GPU work while scrolling.
   */
  blur?: boolean;
  /** Drop the float shadow (for glass nested inside glass). */
  flat?: boolean;
};

function rgba(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * A liquid-glass panel: the sky behind it blurred, a tint matched to the time of day, a soft
 * top-down sheen, a brighter rim along the top-left edge (light catching it) and a float
 * shadow. Children are laid out by `style` like any View.
 */
export function Glass({
  radius = 28,
  blur = true,
  flat = false,
  style,
  children,
  ...rest
}: GlassProps) {
  const { scene, blurTarget } = useSky();
  const { glass } = scene;
  const light = isLightScene(scene);

  return (
    <View style={[{ borderRadius: radius }, !flat && styles.float, style]} {...rest}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.clip]}>
        {blur && (
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={24}
            blurReductionFactor={1}
            tint={light ? 'light' : 'dark'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: rgba(glass.color, glass.alpha),
              experimental_backgroundImage: `linear-gradient(180deg, rgba(255,255,255,${glass.sheen.toFixed(3)}) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.08) 100%)`,
            },
          ]}
        />
        <View style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  float: { boxShadow: '0px 6px 18px rgba(0,0,0,0.18)' },
  clip: { overflow: 'hidden' },
  // A specular edge: bright where light would hit (top, left), fading around the panel.
  rim: {
    borderWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderLeftColor: 'rgba(255,255,255,0.4)',
    borderRightColor: 'rgba(255,255,255,0.16)',
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
});
