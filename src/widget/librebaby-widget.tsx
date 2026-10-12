import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetModel, WidgetRow } from './widget-model';

// The app icon's colors, so the widget reads as LibreBaby in light and dark launchers alike.
const NIGHT = '#2B3A8F';
const MOON = '#FFE7A3';
const TEXT = '#FFFFFF';
const MUTED = '#C9D1F2';

/**
 * Home-screen widget: last feed, next sleep window (or asleep since), last diaper.
 * Tapping anywhere opens the app. Only imported in installed builds (not Expo Go).
 */
export function LibreBabyWidget({ model }: { model: WidgetModel }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Open LibreBaby"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: NIGHT,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
      <TextWidget
        text={model.kind === 'ready' ? `🌙 ${model.childName}` : '🌙 LibreBaby'}
        style={{ fontSize: 15, fontWeight: '700', color: MOON }}
        maxLines={1}
        truncate="END"
      />
      {model.kind === 'ready' ? (
        model.rows.map((row) => <Row key={row.label} row={row} />)
      ) : (
        <TextWidget text="Open LibreBaby to get started" style={{ fontSize: 14, color: MUTED }} />
      )}
    </FlexWidget>
  );
}

function Row({ row }: { row: WidgetRow }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <TextWidget text={row.label} style={{ width: 96, fontSize: 12, color: MUTED }} maxLines={1} />
      <TextWidget
        text={row.detail ? `${row.value}  ·  ${row.detail}` : row.value}
        style={{ fontSize: 14, fontWeight: '600', color: TEXT }}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  );
}
