import { PHOSPHOR, type PhosphorName } from './phosphor-paths';

/**
 * Icons LibreBaby needs that no icon set has (bottle, diaper, pump, breast, dirty diaper),
 * drawn on Phosphor's 256 grid in its duotone style so they sit naturally beside it:
 * a soft background shape at 20% opacity plus a 16-unit rounded outline.
 */
export const CUSTOM = {
  bottle: {
    duo: [
      'M116,88h24a24,24,0,0,1,24,24v88a24,24,0,0,1-24,24H116a24,24,0,0,1-24-24V112A24,24,0,0,1,116,88Z',
    ],
    stroke: [
      'M112,64V52a16,16,0,0,1,32,0V64',
      'M104,64h48a8,8,0,0,1,8,8v8a8,8,0,0,1-8,8H104a8,8,0,0,1-8-8V72A8,8,0,0,1,104,64Z',
      'M116,88h24a24,24,0,0,1,24,24v88a24,24,0,0,1-24,24H116a24,24,0,0,1-24-24V112A24,24,0,0,1,116,88Z',
      'M92,128h24M92,160h24M92,192h24',
    ],
  },
  diaper: {
    duo: ['M40,80H216v32c0,56-40,96-88,96S40,168,40,112Z'],
    stroke: ['M40,80H216v32c0,56-40,96-88,96S40,168,40,112Z', 'M40,112H216', 'M96,176q32,20 64,0'],
  },
  pump: {
    duo: ['M72,48H184l-36,56H108Z'],
    stroke: [
      'M72,48H184l-36,56H108Z',
      'M116,104h24a16,16,0,0,1,16,16v80a16,16,0,0,1-16,16H116a16,16,0,0,1-16-16V120A16,16,0,0,1,116,104Z',
      'M100,144h20M100,176h20',
    ],
  },
  breast: {
    duo: ['M52,140a76,76,0,1,0,152,0a76,76,0,1,0-152,0Z'],
    stroke: [
      'M52,140a76,76,0,0,0,152,0',
      'M52,140c0-48,30-84,76-92',
      'M116,164a12,12,0,1,0,24,0a12,12,0,1,0-24,0Z',
    ],
  },
  'diaper-dirty': {
    duo: [
      'M80,208H176a32,32,0,0,0,8-63a28,28,0,0,0-20-45h-2a34,34,0,0,0-68,0h-2a28,28,0,0,0-20,45a32,32,0,0,0,8,63Z',
    ],
    stroke: [
      'M80,208H176a32,32,0,0,0,8-63a28,28,0,0,0-20-45h-2a34,34,0,0,0-68,0h-2a28,28,0,0,0-20,45a32,32,0,0,0,8,63Z',
      'M88,145H168',
    ],
  },
} as const;

type CustomName = keyof typeof CUSTOM;
export type IconName = PhosphorName | CustomName;

type Shapes = { duo: readonly string[]; solid: readonly string[]; stroke: readonly string[] };

/** The paths for an icon on the 256 grid: soft duotone shapes, filled shapes, outlines. */
export function iconShapes(name: IconName): Shapes {
  const custom = (CUSTOM as Record<string, { duo: readonly string[]; stroke: readonly string[] }>)[
    name
  ];
  if (custom) return { duo: custom.duo, solid: [], stroke: custom.stroke };
  const phosphor = PHOSPHOR[name as PhosphorName];
  return { duo: phosphor.duo, solid: phosphor.solid, stroke: [] };
}

/** An icon as a standalone SVG document (for the home-screen widget). */
export function iconSvg(name: IconName, color: string, size: number): string {
  const { duo, solid, stroke } = iconShapes(name);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">` +
    duo.map((d) => `<path d="${d}" fill="${color}" opacity="0.2"/>`).join('') +
    solid.map((d) => `<path d="${d}" fill="${color}"/>`).join('') +
    stroke
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
      )
      .join('') +
    `</svg>`
  );
}
