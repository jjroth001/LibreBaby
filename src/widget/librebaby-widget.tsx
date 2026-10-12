// The widget library calls these components as plain functions, so the React Compiler
// (on for the rest of the app) must not rewrite them with hooks — that throws
// "Invalid hook call" and the widget is never drawn.
'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetModel, WidgetRow } from './widget-model';

// The app icon's colors, so the widget reads as LibreBaby in light and dark launchers alike.
const NIGHT = '#2B3A8F';
const MOON = '#FFE7A3';
const TEXT = '#FFFFFF';
const MUTED = '#C9D1F2';

/** The default 4×2 widget on a typical phone, in dp; text sizes are tuned for this. */
const BASE_WIDTH = 360;
const BASE_HEIGHT = 190;

/** Scale text with the widget's size, so a bigger widget gets bigger text (within reason). */
function textScale(width?: number, height?: number): number {
  if (!width || !height) return 1;
  const scale = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
  return Math.min(1.6, Math.max(0.85, scale));
}

type WidgetProps = {
  model: WidgetModel;
  /** Widget size in dp, from Android; text scales to fit. */
  width?: number;
  height?: number;
};

/**
 * Home-screen widget: last feed, next sleep window (or asleep since), last diaper.
 * Tapping anywhere opens the app. Only imported in installed builds (not Expo Go).
 */
export function LibreBabyWidget({ model, width, height }: WidgetProps) {
  const s = textScale(width, height);
  const size = (base: number) => Math.round(base * s);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Open LibreBaby"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: NIGHT,
        borderRadius: 24,
        paddingHorizontal: size(18),
        paddingVertical: size(14),
        flexDirection: 'column',
      }}>
      <TextWidget
        text={model.kind === 'ready' ? `🌙 ${model.childName}` : '🌙 LibreBaby'}
        style={{ fontSize: size(17), fontWeight: '700', color: MOON }}
        maxLines={1}
        truncate="END"
      />
      {/* Rows share the remaining height evenly instead of bunching at one end. */}
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
        }}>
        {model.kind === 'ready' ? (
          model.rows.map((row) => <Row key={row.label} row={row} size={size} />)
        ) : (
          <TextWidget
            text="Open LibreBaby to get started"
            style={{ fontSize: size(17), color: MUTED }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

/** Shown if drawing the real widget fails, so it's never just blank. */
export function FallbackWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: NIGHT,
        borderRadius: 24,
        padding: 16,
        justifyContent: 'center',
      }}>
      <TextWidget text="🌙 Tap to open LibreBaby" style={{ fontSize: 17, color: MOON }} />
    </FlexWidget>
  );
}

/** "Last feed   2:55 AM  Breast · L 23m": label, then the time large and the detail smaller. */
function Row({ row, size }: { row: WidgetRow; size: (base: number) => number }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <TextWidget
        text={row.label}
        style={{ width: size(104), fontSize: size(15), color: MUTED }}
        maxLines={1}
      />
      <TextWidget
        text={row.value}
        style={{ fontSize: size(22), fontWeight: '700', color: TEXT }}
        maxLines={1}
      />
      {row.detail ? (
        <TextWidget
          text={`  ${row.detail}`}
          style={{ fontSize: size(16), color: MUTED }}
          maxLines={1}
          truncate="END"
        />
      ) : null}
    </FlexWidget>
  );
}
