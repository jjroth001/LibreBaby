// The widget library calls these components as plain functions, so the React Compiler
// (on for the rest of the app) must not rewrite them with hooks — that throws
// "Invalid hook call" and the widget is never drawn.
'use no memo';

import type { ReactNode } from 'react';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { iconSvg, type IconName } from '@/components/icons/icon-paths';
import type { Scene } from '@/lib/sky';
import { skySvg } from '@/lib/sky-svg';

/** Shared look for every LibreBaby widget: the app's sky, glass, and header. */

export const RADIUS = 24;

export type Color = `#${string}` | `rgba(${number}, ${number}, ${number}, ${number})`;

/** "#RRGGBB" at the given opacity, in the rgba() form widgets accept. */
export function withAlpha(hex: string, alpha: number): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Text on an accent-colored button: the sky's darkest blue on light accents, else white. */
export function onAccent(scene: Scene): Color {
  return (scene.text === '#FFFFFF' ? scene.sky[0] : '#FFFFFF') as Color;
}

/** Glass rows without blur (widgets can't blur), so slightly more opaque than in the app. */
export function glassColor(scene: Scene): Color {
  return withAlpha(scene.glass.color, Math.min(0.85, scene.glass.alpha + 0.08));
}

export type Sizer = (base: number) => number;

/**
 * Text and spacing scale with the widget's size, so a bigger widget gets bigger text
 * (within reason). `base` is the size, in dp, the layout was tuned for.
 */
export function sizer(
  base: { width: number; height: number },
  width?: number,
  height?: number,
): Sizer {
  const scale =
    width && height
      ? Math.min(1.6, Math.max(0.85, Math.min(width / base.width, height / base.height)))
      : 1;
  return (n) => Math.round(n * scale);
}

type FrameProps = {
  scene: Scene;
  base: { width: number; height: number };
  width?: number;
  height?: number;
  size: Sizer;
  /** What tapping the widget (outside any button) does; opens the app by default. */
  clickAction?: string;
  clickActionData?: Record<string, string>;
  accessibilityLabel: string;
  children: ReactNode;
};

/** The sky as a rounded picture, with the content in a padded column on top. */
export function WidgetFrame({
  scene,
  base,
  width,
  height,
  size,
  clickAction = 'OPEN_APP',
  clickActionData,
  accessibilityLabel,
  children,
}: FrameProps) {
  const w = Math.round(width ?? base.width);
  const h = Math.round(height ?? base.height);
  return (
    <OverlapWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      accessibilityLabel={accessibilityLabel}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: RADIUS,
        // Behind the sky picture, in case it's letterboxed by a few dp.
        backgroundColor: scene.sky[1] as `#${string}`,
      }}>
      <SvgWidget
        svg={skySvg(scene, w, h, RADIUS)}
        style={{ height: 'match_parent', width: 'match_parent' }}
      />
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          paddingHorizontal: size(14),
          paddingVertical: size(12),
          flexDirection: 'column',
        }}>
        {children}
      </FlexWidget>
    </OverlapWidget>
  );
}

type HeaderProps = {
  icon: IconName;
  title: string;
  scene: Scene;
  size: Sizer;
  /** Smaller title, for the 2×2 tiles. */
  small?: boolean;
};

/** Icon and serif title, as on the app's screens. */
export function Header({ icon, title, scene, size, small }: HeaderProps) {
  const iconSize = size(small ? 18 : 20);
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SvgWidget
        svg={iconSvg(icon, scene.accent, iconSize)}
        style={{ width: iconSize, height: iconSize }}
      />
      <TextWidget
        text={`  ${title}`}
        style={{
          fontSize: size(small ? 15 : 18),
          fontFamily: 'serif',
          color: (small ? scene.textMuted : scene.text) as Color,
        }}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  );
}
