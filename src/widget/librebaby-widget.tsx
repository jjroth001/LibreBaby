// The widget library calls these components as plain functions, so the React Compiler
// (on for the rest of the app) must not rewrite them with hooks — that throws
// "Invalid hook call" and the widget is never drawn.
'use no memo';

import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { iconSvg, type IconName } from '@/components/icons/icon-paths';
import { SCENES, type Scene } from '@/lib/sky';
import { skySvg } from '@/lib/sky-svg';

import { switchTarget, WIDGET_ACTIONS } from './widget-actions';
import type { WidgetModel, WidgetRow, WidgetTimer } from './widget-model';

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

/** "#RRGGBB" at the given opacity, in the rgba() form widgets accept. */
function withAlpha(hex: string, alpha: number): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Text on an accent-colored button: the sky's darkest blue on light accents, else white. */
function onAccent(scene: Scene): Color {
  return (scene.text === '#FFFFFF' ? scene.sky[0] : '#FFFFFF') as Color;
}

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
 * app. While a sleep or breastfeeding timer runs, it shows that timer instead, with buttons
 * to stop it (or switch sides). Only imported in installed builds (not Expo Go).
 */
export function LibreBabyWidget({ model, width, height }: WidgetProps) {
  const s = textScale(width, height);
  const size = (base: number) => Math.round(base * s);
  const { scene } = model;
  const w = Math.round(width ?? BASE_WIDTH);
  const h = Math.round(height ?? BASE_HEIGHT);
  const text = scene.text as Color;
  const muted = scene.textMuted as Color;
  const timer = model.kind === 'ready' ? model.timer : null;
  const title =
    model.kind !== 'ready'
      ? 'LibreBaby'
      : timer?.kind === 'sleep'
        ? `${model.childName} is asleep`
        : timer?.kind === 'breast'
          ? timer.activeSide
            ? 'Breastfeeding'
            : 'Breastfeeding · paused'
          : model.childName;
  const titleIcon: IconName =
    timer?.kind === 'sleep' ? 'moon' : timer?.kind === 'breast' ? 'breast' : 'moon-stars';

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
            svg={iconSvg(titleIcon, scene.accent, size(20))}
            style={{ width: size(20), height: size(20) }}
          />
          <TextWidget
            text={`  ${title}`}
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
          {timer ? (
            <TimerBody timer={timer} scene={scene} size={size} text={text} muted={muted} />
          ) : model.kind === 'ready' ? (
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

type TimerProps = {
  timer: WidgetTimer;
  scene: Scene;
  size: (base: number) => number;
  text: Color;
  muted: Color;
};

/** A running timer in big type, with buttons that act on it without opening the app. */
function TimerBody({ timer, scene, size, text, muted }: TimerProps) {
  if (timer.kind === 'sleep') {
    return (
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', alignItems: 'center' }}>
        <TextWidget
          text={timer.elapsed}
          style={{ fontSize: size(40), fontWeight: '600', color: text }}
          maxLines={1}
        />
        <TextWidget
          text={`since ${timer.since}`}
          style={{ fontSize: size(13), color: muted }}
          maxLines={1}
        />
        <FlexWidget style={{ height: size(8), width: 1 }} />
        <ActionButton
          label="Woke up"
          icon="sun"
          primary
          clickAction={WIDGET_ACTIONS.wake}
          clickActionData={{ eventId: timer.eventId }}
          scene={scene}
          size={size}
          width={size(180)}
        />
      </FlexWidget>
    );
  }

  const target = switchTarget(timer.activeSide, timer.lastSide);
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        <SideTile side="L" timer={timer} scene={scene} size={size} text={text} muted={muted} />
        <FlexWidget style={{ width: size(10), height: 1 }} />
        <SideTile side="R" timer={timer} scene={scene} size={size} text={text} muted={muted} />
      </FlexWidget>
      <FlexWidget style={{ height: size(8), width: 1 }} />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        <ActionButton
          label={timer.activeSide ? 'Switch side' : `Resume ${target === 'L' ? 'left' : 'right'}`}
          icon={timer.activeSide ? 'arrows-clockwise' : 'timer'}
          clickAction={WIDGET_ACTIONS.side}
          clickActionData={{ eventId: timer.eventId, side: target }}
          scene={scene}
          size={size}
        />
        <FlexWidget style={{ width: size(10), height: 1 }} />
        <ActionButton
          label="Done"
          icon="check"
          primary
          clickAction={WIDGET_ACTIONS.done}
          clickActionData={{ eventId: timer.eventId }}
          scene={scene}
          size={size}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

type SideTileProps = {
  side: 'L' | 'R';
  timer: Extract<WidgetTimer, { kind: 'breast' }>;
  scene: Scene;
  size: (base: number) => number;
  text: Color;
  muted: Color;
};

/** One breast's time so far; tapping it works like the side buttons in the app. */
function SideTile({ side, timer, scene, size, text, muted }: SideTileProps) {
  const active = timer.activeSide === side;
  const label = side === 'L' ? 'left' : 'right';
  return (
    <FlexWidget
      clickAction={WIDGET_ACTIONS.side}
      clickActionData={{ eventId: timer.eventId, side }}
      accessibilityLabel={active ? `Pause the ${label} side` : `Feed on the ${label}`}
      style={{
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: active ? withAlpha(scene.accent, 0.24) : glassColor(scene),
        borderRadius: size(16),
        paddingVertical: size(6),
      }}>
      <TextWidget
        text={side === 'L' ? 'Left' : 'Right'}
        style={{ fontSize: size(13), color: active ? text : muted }}
      />
      <TextWidget
        text={side === 'L' ? timer.left : timer.right}
        style={{ fontSize: size(24), fontWeight: '600', color: text }}
        maxLines={1}
      />
      {/* Always there, so both tiles keep the same height; invisible on the idle side. */}
      <FlexWidget
        style={{
          width: size(28),
          height: size(3),
          borderRadius: size(2),
          backgroundColor: withAlpha(scene.accent, active ? 1 : 0),
        }}
      />
    </FlexWidget>
  );
}

type ActionButtonProps = {
  label: string;
  icon: IconName;
  /** The main action: filled with the accent color. */
  primary?: boolean;
  clickAction: string;
  clickActionData: Record<string, string>;
  scene: Scene;
  size: (base: number) => number;
  /** Fixed width; otherwise it shares the row with its neighbour. */
  width?: number;
};

function ActionButton({
  label,
  icon,
  primary,
  clickAction,
  clickActionData,
  scene,
  size,
  width,
}: ActionButtonProps) {
  const color = primary ? onAccent(scene) : (scene.text as Color);
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      accessibilityLabel={label}
      style={{
        ...(width ? { width } : { flex: 1 }),
        height: size(38),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? (scene.accent as Color) : glassColor(scene),
        borderRadius: size(19),
      }}>
      <SvgWidget
        svg={iconSvg(icon, color, size(18))}
        style={{ width: size(18), height: size(18) }}
      />
      <TextWidget
        text={`  ${label}`}
        style={{ fontSize: size(15), fontWeight: '600', color }}
        maxLines={1}
      />
    </FlexWidget>
  );
}
