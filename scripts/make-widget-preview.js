/**
 * Renders the widget-picker preview (assets/images/widget-preview.png): a mock of the
 * LibreBaby widget with sample data, over the app's real night sky and icons. The sky and
 * icon code is TypeScript, so bundle it first:
 *   npm install --no-save @resvg/resvg-js@2.6.2
 *   echo "export * from './src/lib/sky'; export * from './src/lib/sky-svg'; export * from './src/components/icons/icon-paths';" > preview-entry.ts
 *   npx esbuild preview-entry.ts --bundle --platform=node --outfile=<tmp>/preview-lib.js
 *   node scripts/make-widget-preview.js assets/images/widget-preview.png <tmp>/preview-lib.js
 */
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const lib = require(path.resolve(process.argv[3]));
const scene = lib.SCENES.night;
const W = 1000;
const H = 440;
const S = W / 360; // the widget is laid out at 360dp wide

const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const icon = (name, x, y, size) =>
  `<g transform="translate(${x},${y}) scale(${size / 256})">${inner(lib.iconSvg(name, scene.accent, 256))}</g>`;
const glass = `rgba(14,18,48,${Math.min(0.85, scene.glass.alpha + 0.08)})`;

const row = (y, ic, label, value, detail) => `
  <rect x="${14 * S}" y="${y}" width="${W - 28 * S}" height="${32 * S}" rx="${14 * S}" fill="${glass}"/>
  ${icon(ic, 24 * S, y + 7 * S, 18 * S)}
  <text x="${48 * S}" y="${y + 21 * S}" font-size="${13 * S}" fill="${scene.textMuted}">${label}</text>
  <text x="${128 * S}" y="${y + 22.5 * S}" font-size="${19 * S}" font-weight="600" fill="${scene.text}">${value}</text>
  <text x="${222 * S}" y="${y + 21 * S}" font-size="${13 * S}" fill="${scene.textMuted}">${detail}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Roboto, Arial, sans-serif">
  ${inner(lib.skySvg(scene, W, H, 24 * S))}
  ${icon('moon-stars', 14 * S, 12 * S, 20 * S)}
  <text x="${42 * S}" y="${28 * S}" font-size="${18 * S}" font-family="Georgia, serif" fill="${scene.text}">Baby</text>
  ${row(42 * S, 'bottle', 'Last feed', '2:10 PM', 'Bottle · 4 oz')}
  ${row(82 * S, 'moon-stars', 'Next sleep', '3:40 – 4:10', '')}
  ${row(122 * S, 'diaper', 'Last diaper', '12:30 PM', 'Wet diaper')}
</svg>`;
fs.writeFileSync(
  process.argv[2],
  new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: W } })
    .render()
    .asPng(),
);
console.log('wrote', process.argv[2]);
