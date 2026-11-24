import { SCENES } from '@/lib/sky';

import { categoryColors, type Category } from './categories';
import { paletteFor, simplePalette, type Palette } from './theme';

// theme.ts imports the web stylesheet; Jest can't parse CSS. (jest.mock is hoisted.)
jest.mock('@/global.css', () => ({}));

type Rgba = [number, number, number, number];

function rgba(color: string): Rgba {
  if (color.startsWith('#')) {
    const n = Number.parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const [r, g, b, a] = color.match(/[\d.]+/g)!.map(Number);
  return [r, g, b, a ?? 1];
}
const over = (top: Rgba, bottom: Rgba): Rgba => [
  ...([0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])) as [number, number, number]),
  1,
];
const luminance = ([r, g, b]: Rgba) => {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (fg: string, bg: string, base?: string) => {
  const back = base ? over(rgba(bg), rgba(base)) : rgba(bg);
  const front = over(rgba(fg), back);
  const [l1, l2] = [luminance(front), luminance(back)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe.each([
  ['light', simplePalette(false)],
  ['dark', simplePalette(true)],
  ['light, increased contrast', simplePalette(false, true)],
  ['dark, increased contrast', simplePalette(true, true)],
] as [string, Palette][])('Simple palette (%s)', (name, p) => {
  const strong = name.includes('contrast');
  it.each(['background', 'card'] as const)('text is readable on the %s', (surface) => {
    expect(contrast(p.text, p[surface])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textSecondary, p[surface])).toBeGreaterThanOrEqual(strong ? 4.5 : 3);
    // Links and accent labels are small text.
    expect(contrast(p.accent, p[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps text readable on inputs and selected rows inside a card', () => {
    expect(contrast(p.text, p.backgroundElement, p.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.text, p.backgroundSelected, p.card)).toBeGreaterThanOrEqual(4.5);
  });

  it('labels selected and primary controls readably', () => {
    expect(contrast(p.onSelected, p.selected)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onSelectedMuted, p.selected)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.onTint, p.tint)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onTint, p.danger)).toBeGreaterThanOrEqual(4.5);
  });

  it('makes the selection stand out from the background (3:1 for UI parts)', () => {
    expect(contrast(p.selected, p.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.chart, p.card)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.growthChild, p.card)).toBeGreaterThanOrEqual(3);
  });
});

describe.each([
  [
    'night',
    paletteFor(SCENES.night.text, SCENES.night.textMuted, SCENES.night.accent, false, true),
  ],
  ['sunset', paletteFor(SCENES.sunset.text, SCENES.sunset.textMuted, SCENES.sunset.accent)],
  ['day', paletteFor(SCENES.day.text, SCENES.day.textMuted, SCENES.day.accent)],
] as [string, Palette][])('Sky palette (%s)', (name, p) => {
  it('labels selected and primary controls readably', () => {
    expect(contrast(p.onSelected, p.selected)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onSelectedMuted, p.selected)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.onTint, p.tint)).toBeGreaterThanOrEqual(4.5);
  });

  it('softens the white of selected controls only at night', () => {
    expect(p.selected === '#FFFFFF').toBe(name !== 'night');
  });
});

describe('Category colors', () => {
  const palettes: [string, Palette, string][] = [
    ['Simple light', simplePalette(false), simplePalette(false).card],
    ['Simple dark', simplePalette(true), simplePalette(true).card],
    // Roughly the glass panel color under light and dark text.
    [
      'sky, dark text',
      paletteFor(SCENES.day.text, SCENES.day.textMuted, SCENES.day.accent),
      '#E6F1FA',
    ],
    ['sky, light text', paletteFor('#FFFFFF', 'rgba(255,255,255,0.8)', '#FFE7A3'), '#1A1F45'],
  ];
  const categories: Category[] = ['sleep', 'feed', 'diaper', 'meds'];
  it.each(palettes)('icons stand out on their soft fill (%s)', (_, p, surface) => {
    for (const category of categories) {
      const { bar, fill } = categoryColors(p, category);
      expect(contrast(bar, fill, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(bar, surface)).toBeGreaterThanOrEqual(3);
    }
  });
});
