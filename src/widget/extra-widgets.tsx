// The widget library calls these components as plain functions, so the React Compiler
// (on for the rest of the app) must not rewrite them with hooks — that throws
// "Invalid hook call" and the widget is never drawn.
'use no memo';

import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { iconSvg } from '@/components/icons/icon-paths';
import type { Scene } from '@/lib/sky';

import {
  ringSvg,
  type FedModel,
  type SleepTileModel,
  type UpNextItem,
  type UpNextModel,
} from './extra-models';
import {
  glassColor,
  Header,
  sizer,
  WidgetFrame,
  withAlpha,
  type Color,
  type Sizer,
} from './widget-parts';

type SizeProps = {
  /** Widget size in dp, from Android; text scales to fit. */
  width?: number;
  height?: number;
};

const GET_STARTED = 'Open LibreBaby to get started';

/* Up next (4×3) ------------------------------------------------------------------------- */

const UP_NEXT_BASE = { width: 360, height: 280 };

/** The Oracle's next few estimates; tapping it opens the Oracle tab. */
export function UpNextWidget({ model, width, height }: { model: UpNextModel } & SizeProps) {
  const size = sizer(UP_NEXT_BASE, width, height);
  const { scene } = model;
  const muted = scene.textMuted as Color;
  return (
    <WidgetFrame
      scene={scene}
      base={UP_NEXT_BASE}
      width={width}
      height={height}
      size={size}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'librebaby://oracle' }}
      accessibilityLabel="Open the Oracle">
      <Header icon="crystal-ball" title="Up next" scene={scene} size={size} />
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
        }}>
        {model.kind === 'ready' && model.items.length > 0 ? (
          model.items.map((item) => (
            <UpNextRow key={item.id} item={item} scene={scene} size={size} />
          ))
        ) : (
          <TextWidget
            text={model.kind === 'ready' ? 'Nothing more expected today' : GET_STARTED}
            style={{ fontSize: size(15), color: muted }}
          />
        )}
      </FlexWidget>
    </WidgetFrame>
  );
}

function UpNextRow({ item, scene, size }: { item: UpNextItem; scene: Scene; size: Sizer }) {
  const likely = item.confidence === 'likely';
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: glassColor(scene),
        borderRadius: size(14),
        paddingHorizontal: size(12),
        paddingVertical: size(7),
      }}>
      <TextWidget
        text={item.time}
        style={{
          width: size(82),
          fontSize: size(16),
          fontWeight: '600',
          color: scene.text as Color,
        }}
        maxLines={1}
      />
      <SvgWidget
        svg={iconSvg(item.icon, scene.accent, size(18))}
        style={{ width: size(18), height: size(18) }}
      />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget
          text={`  ${item.name}`}
          style={{ fontSize: size(15), color: scene.text as Color }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
      <FlexWidget
        style={{
          backgroundColor: likely ? withAlpha(scene.accent, 0.28) : withAlpha(scene.glass.color, 0),
          borderRadius: size(10),
          paddingHorizontal: size(9),
          paddingVertical: size(2),
        }}>
        <TextWidget
          text={likely ? 'likely' : 'maybe'}
          style={{ fontSize: size(12), color: (likely ? scene.text : scene.textMuted) as Color }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/* Small tiles (2×2) ----------------------------------------------------------------------- */

const TILE_BASE = { width: 170, height: 170 };

/** Time since the last feed, and which side is next. */
export function FedWidget({ model, width, height }: { model: FedModel } & SizeProps) {
  const size = sizer(TILE_BASE, width, height);
  const { scene } = model;
  const text = scene.text as Color;
  const muted = scene.textMuted as Color;
  return (
    <WidgetFrame
      scene={scene}
      base={TILE_BASE}
      width={width}
      height={height}
      size={size}
      accessibilityLabel="Open LibreBaby">
      <Header icon="bottle" title="Last feed" scene={scene} size={size} small />
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {model.kind === 'ready' ? (
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'center' }}>
            <TextWidget
              text={model.value}
              style={{ fontSize: size(32), fontWeight: '600', color: text }}
              maxLines={1}
            />
            <TextWidget
              text={model.detail}
              style={{ fontSize: size(12), color: muted }}
              maxLines={1}
              truncate="END"
            />
          </FlexWidget>
        ) : (
          <TextWidget text={GET_STARTED} style={{ fontSize: size(13), color: muted }} />
        )}
      </FlexWidget>
      {model.kind === 'ready' && model.nextSide ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            alignItems: 'center',
            backgroundColor: glassColor(scene),
            borderRadius: size(13),
            paddingVertical: size(4),
          }}>
          <TextWidget
            text={`Next side: ${model.nextSide}`}
            style={{ fontSize: size(13), color: text }}
            maxLines={1}
          />
        </FlexWidget>
      ) : null}
    </WidgetFrame>
  );
}

/** How close the next sleep window is, as a ring; or how long the baby has been asleep. */
export function SleepTileWidget({ model, width, height }: { model: SleepTileModel } & SizeProps) {
  const size = sizer(TILE_BASE, width, height);
  const { scene } = model;
  const text = scene.text as Color;
  const muted = scene.textMuted as Color;
  const ring = size(92);

  const figures =
    model.kind === 'ready' ? (
      <FlexWidget
        style={{
          width: ring,
          height: ring,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <TextWidget
          text={model.value}
          style={{
            fontSize: size(model.progress === null ? 30 : 22),
            fontWeight: '600',
            color: text,
          }}
          maxLines={1}
        />
        <TextWidget
          text={model.detail}
          style={{ fontSize: size(11), color: muted }}
          maxLines={1}
          truncate="END"
        />
      </FlexWidget>
    ) : (
      <TextWidget text={GET_STARTED} style={{ fontSize: size(13), color: muted }} />
    );

  return (
    <WidgetFrame
      scene={scene}
      base={TILE_BASE}
      width={width}
      height={height}
      size={size}
      accessibilityLabel="Open LibreBaby">
      <Header
        icon={model.kind === 'ready' && model.title === 'Asleep' ? 'moon-stars' : 'moon'}
        title={model.kind === 'ready' ? model.title : 'Next sleep'}
        scene={scene}
        size={size}
        small
      />
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {model.kind === 'ready' && model.progress !== null ? (
          <OverlapWidget style={{ width: ring, height: ring }}>
            <SvgWidget
              svg={ringSvg(model.progress, ring, withAlpha(scene.text, 0.16), scene.accent)}
              style={{ width: ring, height: ring }}
            />
            {figures}
          </OverlapWidget>
        ) : (
          figures
        )}
      </FlexWidget>
      {model.kind === 'ready' && model.footer ? (
        <TextWidget
          text={model.footer}
          style={{ fontSize: size(12), color: muted, textAlign: 'center' }}
          maxLines={1}
        />
      ) : null}
    </WidgetFrame>
  );
}
