/**
 * The time-of-day sky: four hand-tuned scenes (night, sunrise, day, sunset) and a blend
 * between them keyed to the actual sunrise/sunset. Everything that colors the UI (glass
 * tint, text) comes from here, so it always matches the sky behind it.
 */

import { sunTimes } from './sun';

export type Scene = {
  /** Sky gradient, top → bottom. */
  sky: [string, string, string];
  /** Soft light around the sun/moon; position as fractions of the screen. */
  glow: { x: number; y: number; r: number; color: string; opacity: number };
  body: {
    x: number;
    y: number;
    r: number;
    color: string;
    kind: 'sun' | 'moon';
  };
  stars: number;
  clouds: number;
  mist: { color: string; opacity: number };
  /**
   * Opacity of a soft veil over the top of the sky (black under light text, white under
   * dark text). Zero in the pure scenes; it peaks while the sky passes through mid-tones
   * where neither text color would be readable on it.
   */
  scrim: number;
  /** Far → near hill silhouettes. */
  hills: [string, string, string];
  /**
   * Glass panel tint (alpha 0–1) and the strength of its top sheen. Alphas are the lightest
   * that keep text ≥4.5:1 and secondary text ≥3:1 over every sky, hill and glow color all
   * day — enforced by the readability test in sky.test.ts.
   */
  glass: { color: string; alpha: number; sheen: number };
  /** Light text on dark scenes, dark text on the bright day sky. */
  text: string;
  textMuted: string;
  accent: string;
};

export type SceneName = 'night' | 'sunrise' | 'day' | 'sunset';

export const SCENES: Record<SceneName, Scene> = {
  night: {
    sky: ['#05081C', '#111A48', '#26346F'],
    glow: { x: 0.75, y: 0.2, r: 0.42, color: '#FFE7A3', opacity: 0.18 },
    body: { x: 0.75, y: 0.2, r: 0.072, color: '#FFF1C9', kind: 'moon' },
    stars: 1,
    clouds: 0,
    mist: { color: '#FFFFFF', opacity: 0.06 },
    scrim: 0,
    hills: ['#1C2860', '#121B47', '#0A102E'],
    glass: { color: '#0E1230', alpha: 0.3, sheen: 0.16 },
    text: '#FFFFFF',
    textMuted: 'rgba(235,239,255,0.74)',
    accent: '#FFE7A3',
  },
  sunrise: {
    sky: ['#2F3A86', '#9C78B8', '#E9A18C'],
    glow: { x: 0.3, y: 0.62, r: 0.64, color: '#FFE1B5', opacity: 0.55 },
    body: { x: 0.3, y: 0.62, r: 0.083, color: '#FFF2D9', kind: 'sun' },
    stars: 0.15,
    clouds: 0.2,
    mist: { color: '#FFD9C2', opacity: 0.45 },
    scrim: 0,
    hills: ['#9A79B4', '#6F5793', '#40336A'],
    glass: { color: '#301E50', alpha: 0.6, sheen: 0.2 },
    text: '#FFFFFF',
    textMuted: 'rgba(255,240,246,0.8)',
    accent: '#FFE1B5',
  },
  day: {
    sky: ['#3C8FDB', '#7DBCEB', '#CFE8F8'],
    glow: { x: 0.78, y: 0.14, r: 0.47, color: '#FFF8D6', opacity: 0.6 },
    body: { x: 0.78, y: 0.14, r: 0.094, color: '#FFFBEA', kind: 'sun' },
    stars: 0,
    clouds: 1,
    mist: { color: '#FFFFFF', opacity: 0.1 },
    scrim: 0,
    hills: ['#9CC4E0', '#86B36B', '#6A9A52'],
    glass: { color: '#FFFFFF', alpha: 0.36, sheen: 0.28 },
    text: '#0D2238',
    textMuted: 'rgba(13,34,56,0.72)',
    accent: '#1D5FAE',
  },
  sunset: {
    sky: ['#24184F', '#9C3B6A', '#DD7A48'],
    glow: { x: 0.67, y: 0.63, r: 0.67, color: '#FFB36E', opacity: 0.6 },
    body: { x: 0.67, y: 0.64, r: 0.1, color: '#FFD9A0', kind: 'sun' },
    stars: 0.1,
    clouds: 0.25,
    mist: { color: '#FFC08A', opacity: 0.3 },
    scrim: 0,
    hills: ['#8A3A66', '#56264F', '#2A1332'],
    glass: { color: '#280E30', alpha: 0.5, sheen: 0.16 },
    text: '#FFFFFF',
    textMuted: 'rgba(255,232,240,0.8)',
    accent: '#FFD39A',
  },
};

const MIN = 60_000;

/**
 * The day as (time, scene) anchors around sunrise and sunset; between anchors the sky
 * blends. Dawn starts 75 min before sunrise; full day by 2h after; sunset colors from
 * 1h before to 20 min after sunset; night by 80 min after.
 */
function anchors(sunrise: number, sunset: number): [number, SceneName][] {
  return [
    [sunrise - 75 * MIN, 'night'],
    [sunrise - 15 * MIN, 'sunrise'],
    [sunrise + 45 * MIN, 'sunrise'],
    [sunrise + 120 * MIN, 'day'],
    [sunset - 120 * MIN, 'day'],
    [sunset - 45 * MIN, 'sunset'],
    [sunset + 20 * MIN, 'sunset'],
    [sunset + 80 * MIN, 'night'],
  ];
}

/** Which two scenes the sky is between at `now`, and how far (0 = all `from`). */
export function sceneBlend(
  now: number,
  sunrise: number,
  sunset: number,
): { from: SceneName; to: SceneName; t: number } {
  const points = anchors(sunrise, sunset);
  if (now <= points[0][0] || now >= points[points.length - 1][0]) {
    return { from: 'night', to: 'night', t: 0 };
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, a] = points[i];
    const [t1, b] = points[i + 1];
    if (now >= t0 && now < t1) return { from: a, to: b, t: (now - t0) / (t1 - t0) };
  }
  return { from: 'night', to: 'night', t: 0 };
}

// --- color math -----------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`.toUpperCase();
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Blends two scenes. The sky blends smoothly; text and glass tint switch at the midpoint
 * (fading text through gray would be unreadable for a while).
 */
export function mixScenes(a: Scene, b: Scene, t: number): Scene {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const near = t < 0.5 ? a : b;
  return {
    sky: [
      mixHex(a.sky[0], b.sky[0], t),
      mixHex(a.sky[1], b.sky[1], t),
      mixHex(a.sky[2], b.sky[2], t),
    ],
    glow: {
      x: lerp(a.glow.x, b.glow.x, t),
      y: lerp(a.glow.y, b.glow.y, t),
      r: lerp(a.glow.r, b.glow.r, t),
      color: mixHex(a.glow.color, b.glow.color, t),
      opacity: lerp(a.glow.opacity, b.glow.opacity, t),
    },
    body: {
      x: lerp(a.body.x, b.body.x, t),
      y: lerp(a.body.y, b.body.y, t),
      r: lerp(a.body.r, b.body.r, t),
      color: mixHex(a.body.color, b.body.color, t),
      kind: near.body.kind,
    },
    stars: lerp(a.stars, b.stars, t),
    clouds: lerp(a.clouds, b.clouds, t),
    mist: {
      color: mixHex(a.mist.color, b.mist.color, t),
      opacity: lerp(a.mist.opacity, b.mist.opacity, t),
    },
    // Readable titles on the open sky through a light/dark text switch (see sky.test.ts).
    scrim: a.text !== b.text ? 0.5 * (1 - Math.abs(2 * t - 1)) : lerp(a.scrim, b.scrim, t),
    hills: [
      mixHex(a.hills[0], b.hills[0], t),
      mixHex(a.hills[1], b.hills[1], t),
      mixHex(a.hills[2], b.hills[2], t),
    ],
    // The glass tint switches together with the text (not faded), so light text never
    // sits on glass that's halfway to the bright day tint.
    glass: { ...near.glass, sheen: lerp(a.glass.sheen, b.glass.sheen, t) },
    text: near.text,
    textMuted: near.textMuted,
    accent: near.accent,
  };
}

/** The scene at `now`, given that day's sunrise and sunset. */
export function sceneAt(now: number, sunrise: number, sunset: number): Scene {
  const { from, to, t } = sceneBlend(now, sunrise, sunset);
  return mixScenes(SCENES[from], SCENES[to], t);
}

/** Without location: typical sunrise 6:30 AM and sunset 7:00 PM, local time. */
export function defaultSunTimes(now: number): {
  sunrise: number;
  sunset: number;
} {
  const d = new Date(now);
  return {
    sunrise: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 30).getTime(),
    sunset: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19, 0).getTime(),
  };
}

/** True when text on this scene is dark (the day sky); used for status bar and widgets. */
export const isLightScene = (scene: Scene) => scene.text !== '#FFFFFF';

/**
 * The scene to show at `now`: always night when asked, otherwise from the real sunrise and
 * sunset at `location` (or typical times without one).
 */
export function sceneFor(
  now: number,
  /** The Simple look has no sky in the app, but the widget still draws one by time of day. */
  appearance: 'sky' | 'night' | 'simple',
  location: { lat: number; lon: number } | null,
): Scene {
  if (appearance === 'night') return SCENES.night;
  if (!location) {
    const { sunrise, sunset } = defaultSunTimes(now);
    return sceneAt(now, sunrise, sunset);
  }
  const d = new Date(now);
  const times = sunTimes(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    location.lat,
    location.lon,
  );
  if (times.kind !== 'normal') return times.kind === 'always-up' ? SCENES.day : SCENES.night;
  return sceneAt(now, times.sunrise, times.sunset);
}
