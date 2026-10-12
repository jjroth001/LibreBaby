/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Dark ink used on solid white controls (selected buttons, the primary pill). */
export const InkOnWhite = '#1B1E3D';

/**
 * UI colors for the current sky (see lib/sky.ts): light text over the night, sunrise and
 * sunset skies, dark text over the day sky. Surfaces are translucent so the sky and the glass
 * panels show through; contrast on glass is enforced by sky.test.ts.
 */
export function paletteFor(text: string, textMuted: string, accent: string) {
  const light = text !== '#FFFFFF';
  return {
    light,
    text,
    textSecondary: textMuted,
    accent,
    background: 'transparent',
    /** Inputs and chips inside a glass panel. */
    backgroundElement: light ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)',
    backgroundSelected: light ? 'rgba(13,34,56,0.12)' : 'rgba(255,255,255,0.22)',
    /** Primary controls: solid white with dark ink, or (by day) deep blue with white. */
    tint: light ? '#1D5FAE' : '#FFFFFF',
    onTint: light ? '#FFFFFF' : InkOnWhite,
    chart: accent,
    // Bands in the text color at low opacity, so they read on any sky; the child's line
    // stays ≥3:1 over them.
    growthBandOuter: light ? 'rgba(13,34,56,0.08)' : 'rgba(255,255,255,0.08)',
    growthBandInner: light ? 'rgba(13,34,56,0.16)' : 'rgba(255,255,255,0.16)',
    growthChild: light ? '#B8400B' : '#FFB070',
    danger: light ? '#B42318' : '#FF9592',
  };
}

export type Palette = ReturnType<typeof paletteFor>;
export type ThemeColor = Exclude<keyof Palette, 'light'>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;
