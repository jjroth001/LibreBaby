import { mixScenes, SCENES, sceneAt, sceneBlend } from './sky';

const H = 3_600_000;
const day = Date.UTC(2026, 9, 12);
const sunrise = day + 6 * H;
const sunset = day + 18 * H;

describe('time-of-day sky', () => {
  it.each([
    [2, 'night'],
    [6, 'sunrise'],
    [13, 'day'],
    [18, 'sunset'],
    [23, 'night'],
  ] as const)('at %ih it is fully %s', (hour, scene) => {
    const blend = sceneBlend(day + hour * H, sunrise, sunset);
    const current = blend.t < 0.5 ? blend.from : blend.to;
    expect(current).toBe(scene);
    expect(sceneAt(day + hour * H, sunrise, sunset).text).toBe(SCENES[scene].text);
  });

  it('blends smoothly between scenes', () => {
    // 8:00 is 120 min after sunrise - 75 → between "sunrise" (6:45) and "day" (8:00): just arriving.
    const blend = sceneBlend(sunrise + 90 * 60_000, sunrise, sunset);
    expect(blend).toMatchObject({ from: 'sunrise', to: 'day' });
    expect(blend.t).toBeGreaterThan(0.5);
    expect(blend.t).toBeLessThan(1);
  });

  it('mixes colors and numbers halfway', () => {
    const mid = mixScenes(SCENES.night, SCENES.day, 0.5);
    expect(mid.stars).toBe(0.5);
    expect(mid.sky[0]).toMatch(/^#[0-9A-F]{6}$/);
    // Text never fades to an unreadable gray: it switches at the midpoint.
    expect([SCENES.night.text, SCENES.day.text]).toContain(mid.text);
  });

  it('keeps the moon at night and the sun by day', () => {
    expect(sceneAt(day + 1 * H, sunrise, sunset).body.kind).toBe('moon');
    expect(sceneAt(day + 12 * H, sunrise, sunset).body.kind).toBe('sun');
  });
});

// --- Readability: text on glass, over every part of the sky, all day ---------------

function rgb(color: string): [number, number, number, number] {
  if (color.startsWith('#')) {
    const n = Number.parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const [r, g, b, a] = color.match(/[\d.]+/g)!.map(Number);
  return [r, g, b, a ?? 1];
}
const over = (top: [number, number, number, number], bottom: [number, number, number]) =>
  [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])) as [number, number, number];
const luminance = ([r, g, b]: [number, number, number]) => {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe('readability on glass', () => {
  it('meets WCAG contrast for text (4.5:1) and secondary text (3:1) all day', () => {
    const failures: string[] = [];
    for (let m = 0; m < 24 * 60; m += 10) {
      const scene = sceneAt(day + m * 60_000, sunrise, sunset);
      const glass = rgb(scene.glass.color);
      glass[3] = scene.glass.alpha;
      // Every sky and hill color, plus the sun/moon glow over the brightest sky color.
      const glowRgb = rgb(scene.glow.color);
      glowRgb[3] = scene.glow.opacity;
      const backdrops = [
        ...[...scene.sky, ...scene.hills].map((c) => over(rgb(c), [0, 0, 0])),
        over(glowRgb, over(rgb(scene.sky[2]), [0, 0, 0])),
        over(glowRgb, over(rgb(scene.sky[1]), [0, 0, 0])),
      ];
      for (const backdrop of backdrops) {
        const behind = `rgb(${backdrop.map(Math.round).join(',')})`;
        const panel = over(glass, backdrop);
        const text = over(rgb(scene.text), panel);
        const muted = over(rgb(scene.textMuted), panel);
        if (contrast(text, panel) < 4.5)
          failures.push(`${m}min text on ${behind}: ${contrast(text, panel).toFixed(2)}`);
        if (contrast(muted, panel) < 3)
          failures.push(`${m}min muted on ${behind}: ${contrast(muted, panel).toFixed(2)}`);
      }
    }
    expect(failures.slice(0, 8)).toEqual([]);
  });
});
