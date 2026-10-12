// The widget library calls these components as plain functions, so the React Compiler
// (on for the rest of the app) must not rewrite them with hooks — that throws
// "Invalid hook call" and the widget is never drawn.
'use no memo';

import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { iconSvg } from '@/components/icons/icon-paths';
import { SCENES, type Scene } from '@/lib/sky';
import { skySvg } from '@/lib/sky-svg';

import type { WidgetModel, WidgetRow } from './widget-model';

/** The default 4×2 widget on a typical phone, in dp; text sizes are tuned for this. */
const BASE_WIDTH = 360;
const BASE_HEIGHT = 190;
const RADIUS = 24;

/** Scale text with the widget's size, so a bigger widget gets bigger text (within reason). */
function textScale(width?: number, height?: number): number {
  if (!width || !height) return 1;
  const scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
  return Math.min(1.6, Math.max(0.85, scale));
}

type Color = `#${string}` | `rgba(${number}, ${number}, ${number}, ${number})`;

/** Glass rows without blur (widgets can't blur), so slightly more opaque than in the app. */
function glassColor(scene: Scene): Color {
  const n = Number.parseInt(scene.glass.color.slice(1), 16);
  const alpha = Math.min(0.85, scene.glass.alpha + 0.08);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

type WidgetProps = {
  model: WidgetModel;
  /** Widget size in dp, from Android; text scales to fit. */
  width?: number;
  height?: number;
};

/**
 * Home-screen widget over the same time-of-day sky as the app: last feed, next sleep
 * window (or asleep since), last diaper, each on a glass row. Tapping anywhere opens the
 * app. Only imported in installed builds (not Expo Go).
 */
export function LibreBabyWidget({ model, width, height }: WidgetProps) {
  const s = textScale(width, height);
  const size = (base: number) => Math.round(base * s);
  const { scene } = model;
  const w = Math.round(width ?? BASE_WIDTH);
  const h = Math.round(height ?? BASE_HEIGHT);
  const text = scene.text as Color;
  const muted = scene.textMuted as Color;

  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Open LibreBaby"
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
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SvgWidget
            svg={iconSvg('moon-stars', scene.accent, size(20))}
            style={{ width: size(20), height: size(20) }}
          />
          <TextWidget
            text={model.kind === 'ready' ? `  ${model.childName}` : '  LibreBaby'}
            style={{ fontSize: size(18), fontFamily: 'serif', color: text }}
            maxLines={1}
            truncate="END"
          />
        </FlexWidget>
        {/* Rows share the remaining height evenly instead of bunching at one end. */}
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            flexDirection: 'column',
            justifyContent: 'space-evenly',
          }}>
          {model.kind === 'ready' ? (
            model.rows.map((row) => (
              <Row key={row.label} row={row} scene={scene} size={size} text={text} muted={muted} />
            ))
          ) : (
            <TextWidget
              text="Open LibreBaby to get started"
              style={{ fontSize: size(16), color: muted }}
            />
          )}
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

/** Shown if drawing the real widget fails, so it's never just blank. */
export function FallbackWidget() {
  const night = SCENES.night;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: night.sky[1] as `#${string}`,
        borderRadius: RADIUS,
        padding: 16,
        justifyContent: 'center',
      }}>
      <TextWidget
        text="Tap to open LibreBaby"
        style={{ fontSize: 17, color: night.accent as `#${string}` }}
      />
    </FlexWidget>
  );
}

type RowProps = {
  row: WidgetRow;
  scene: Scene;
  size: (base: number) => number;
  text: Color;
  muted: Color;
};

/** A glass row: icon, the clock time large, then the detail; the label is in the icon. */
function Row({ row, scene, size, text, muted }: RowProps) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: glassColor(scene),
        borderRadius: size(14),
        paddingHorizontal: size(10),
        paddingVertical: size(5),
      }}>
      <SvgWidget
        svg={iconSvg(row.icon, scene.accent, size(18))}
        style={{ width: size(18), height: size(18) }}
      />
      <TextWidget
        text={`  ${row.label}  `}
        style={{ fontSize: size(13), color: muted }}
        maxLines={1}
      />
      <TextWidget
        text={row.value}
        style={{ fontSize: size(19), fontWeight: '600', color: text }}
        maxLines={1}
      />
      {row.detail ? (
        <TextWidget
          text={`  ${row.detail}`}
          style={{ fontSize: size(13), color: muted }}
          maxLines={1}
          truncate="END"
        />
      ) : null}
    </FlexWidget>
  );
}
