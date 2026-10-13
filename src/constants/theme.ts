/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Dark ink used on solid white controls (selected buttons, the primary pill). */
export const InkOnWhite = '#1B1E3D';

export type Palette = {
  /** Dark text on a light background (the day sky, or Simple in light mode). */
  light: boolean;
  /** The plain look: solid surfaces instead of glass over the sky. */
  simple: boolean;
  text: string;
  textSecondary: string;
  accent: string;
  background: string;
  /** Inputs and chips inside a panel. */
  backgroundElement: string;
  backgroundSelected: string;
  /** Primary buttons. */
  tint: string;
  onTint: string;
  /** Selected state: the tab bubble, segments, open menu, chosen age. */
  selected: string;
  onSelected: string;
  onSelectedMuted: string;
  /** Simple look: panel fill and hairline border. */
  card: string;
  border: string;
  chart: string;
  growthBandOuter: string;
  growthBandInner: string;
  growthChild: string;
  /** Roughly the panel's color, for a ring that separates marks from what's behind. */
  surface: string;
  danger: string;
};

/**
 * UI colors for the current sky (see lib/sky.ts): light text over the night, sunrise and
 * sunset skies, dark text over the day sky. Surfaces are translucent so the sky and the glass
 * panels show through; contrast on glass is enforced by sky.test.ts. `contrast` (Increase
 * contrast) makes secondary text full strength; Glass also turns more opaque.
 */
export function paletteFor(
  text: string,
  textMuted: string,
  accent: string,
  contrast = false,
): Palette {
  const light = text !== '#FFFFFF';
  return {
    light,
    simple: false,
    text,
    textSecondary: contrast ? text : textMuted,
    accent,
    background: 'transparent',
    backgroundElement: light ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)',
    backgroundSelected: light ? 'rgba(13,34,56,0.12)' : 'rgba(255,255,255,0.22)',
    // Primary controls: solid white with dark ink, or (by day) deep blue with white.
    tint: light ? '#1D5FAE' : '#FFFFFF',
    onTint: light ? '#FFFFFF' : InkOnWhite,
    selected: '#FFFFFF',
    onSelected: InkOnWhite,
    onSelectedMuted: 'rgba(27,30,61,0.7)',
    card: 'transparent',
    border: 'transparent',
    chart: accent,
    // Bands in the text color at low opacity, so they read on any sky; the child's line
    // stays ≥3:1 over them.
    growthBandOuter: light ? 'rgba(13,34,56,0.08)' : 'rgba(255,255,255,0.08)',
    growthBandInner: light ? 'rgba(13,34,56,0.16)' : 'rgba(255,255,255,0.16)',
    growthChild: light ? '#B8400B' : '#FFB070',
    surface: light ? '#E6F1FA' : '#1A1F45',
    danger: light ? '#B42318' : '#FF9592',
  };
}

/**
 * The Simple look: solid, calm colors that follow the phone's light or dark mode. Text is
 * ≥4.5:1 and secondary text ≥3:1 (≥4.5:1 with Increase contrast) on both the background
 * and the cards — see theme.test.ts.
 */
export function simplePalette(dark: boolean, contrast = false): Palette {
  if (dark) {
    return {
      light: false,
      simple: true,
      text: '#F2F3F7',
      textSecondary: contrast ? '#E1E3EA' : '#AEB2BE',
      accent: '#9DB2FF',
      background: '#101218',
      backgroundElement: 'rgba(255,255,255,0.07)',
      backgroundSelected: 'rgba(255,255,255,0.14)',
      tint: '#9DB2FF',
      onTint: '#0E1433',
      selected: '#C9D4FF',
      onSelected: '#141B3D',
      onSelectedMuted: 'rgba(20,27,61,0.72)',
      card: '#1B1E27',
      border: contrast ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.09)',
      chart: '#8EA6FF',
      growthBandOuter: 'rgba(255,255,255,0.07)',
      growthBandInner: 'rgba(255,255,255,0.14)',
      growthChild: '#FFB070',
      surface: '#1B1E27',
      danger: '#FF9592',
    };
  }
  return {
    light: true,
    simple: true,
    text: '#16192B',
    textSecondary: contrast ? '#2E3142' : '#585C6E',
    accent: '#2F5BD3',
    background: '#F4F2EE',
    backgroundElement: 'rgba(22,25,43,0.06)',
    backgroundSelected: 'rgba(22,25,43,0.12)',
    tint: '#2F5BD3',
    onTint: '#FFFFFF',
    selected: '#2F5BD3',
    onSelected: '#FFFFFF',
    onSelectedMuted: 'rgba(255,255,255,0.82)',
    card: '#FFFFFF',
    border: contrast ? 'rgba(22,25,43,0.45)' : 'rgba(22,25,43,0.10)',
    chart: '#2F5BD3',
    growthBandOuter: 'rgba(22,25,43,0.06)',
    growthBandInner: 'rgba(22,25,43,0.12)',
    growthChild: '#B8400B',
    surface: '#FFFFFF',
    danger: '#B42318',
  };
}

export type ThemeColor = Exclude<keyof Palette, 'light' | 'simple'>;

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
