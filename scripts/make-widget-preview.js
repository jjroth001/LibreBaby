/**
 * Renders the widget-picker previews (assets/images/widget-preview*.png): mocks of each
 * LibreBaby widget with sample data, over the app's real night sky and icons. The sky and
 * icon code is TypeScript, so bundle it first:
 *   npm install --no-save @resvg/resvg-js@2.6.2
 *   echo "export * from './src/lib/sky'; export * from './src/lib/sky-svg'; export * from './src/components/icons/icon-paths';" > preview-entry.ts
 *   npx esbuild preview-entry.ts --bundle --platform=node --outfile=<tmp>/preview-lib.js
 *   node scripts/make-widget-preview.js assets/images <tmp>/preview-lib.js
 */
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const lib = require(path.resolve(process.argv[3]));
const outDir = process.argv[2];
const scene = lib.SCENES.night;
const FONT = 'Segoe UI, Roboto, Arial, sans-serif';

const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const glass = `rgba(14,18,48,${Math.min(0.85, scene.glass.alpha + 0.08)})`;

/** Draws one widget `wdp`×`hdp` (dp) at `pxWidth` pixels wide; `body` works in dp. */
function render(file, wdp, hdp, pxWidth, body) {
  const S = pxWidth / wdp;
  const W = pxWidth;
  const H = Math.round(hdp * S);
  const icon = (name, x, y, size) =>
    `<g transform="translate(${x},${y}) scale(${size / 256})">${inner(lib.iconSvg(name, scene.accent, 256))}</g>`;
  const text = (x, y, str, size, opts = {}) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${opts.weight ?? 400}" fill="${opts.muted ? scene.textMuted : (opts.fill ?? scene.text)}" text-anchor="${opts.anchor ?? 'start'}"${opts.serif ? ' font-family="Georgia, serif"' : ''}>${str}</text>`;
  const rect = (x, y, w, h, r, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
  const header = (name, title, small) =>
    `${icon(name, 14, 12, small ? 18 : 20)}${text(small ? 38 : 42, 28, title, small ? 15 : 18, { serif: true, muted: small })}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  ${inner(lib.skySvg(scene, W, H, 24 * S))}
  <g transform="scale(${S})">${body({ icon, text, rect, header, w: wdp, h: hdp })}</g>
</svg>`;
  fs.writeFileSync(
    path.join(outDir, file),
    new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: W } })
      .render()
      .asPng(),
  );
  console.log('wrote', file);
}

// The main 4×2 widget.
render('widget-preview.png', 360, 158, 1000, ({ icon, text, rect, header, w }) => {
  const row = (y, ic, label, value, detail) => `
    ${rect(14, y, w - 28, 32, 14, glass)}
    ${icon(ic, 24, y + 7, 18)}
    ${text(48, y + 21, label, 13, { muted: true })}
    ${text(128, y + 22.5, value, 19, { weight: 600 })}
    ${text(222, y + 21, detail, 13, { muted: true })}`;
  return `${header('moon-stars', 'Baby')}
    ${row(42, 'bottle', 'Last feed', '2:10 PM', 'Bottle · 4 oz')}
    ${row(82, 'moon-stars', 'Next sleep', '3:40 – 4:10', '')}
    ${row(122, 'diaper', 'Last diaper', '12:30 PM', 'Wet diaper')}`;
});

// Up next (4×3).
render('widget-preview-up-next.png', 360, 280, 1000, ({ icon, text, rect, header, w }) => {
  const row = (i, time, ic, name, likely) => {
    const y = 48 + i * 56;
    return `${rect(14, y, w - 28, 46, 14, glass)}
      ${text(28, y + 29, time, 16, { weight: 600 })}
      ${icon(ic, 110, y + 14, 18)}
      ${text(136, y + 29, name, 15)}
      ${likely ? rect(w - 92, y + 12, 64, 22, 11, 'rgba(255,231,163,0.28)') : ''}
      ${text(w - 60, y + 28, likely ? 'likely' : 'maybe', 12, { anchor: 'middle', muted: !likely })}`;
  };
  return `${header('crystal-ball', 'Up next')}
    ${row(0, '4:10 PM', 'moon', 'Nap', true)}
    ${row(1, '5:30 PM', 'bottle', 'Feed', true)}
    ${row(2, '6:15 PM', 'drop', 'Diaper', false)}
    ${row(3, '7:30 PM', 'moon-stars', 'Bedtime', true)}`;
});

// Last feed (2×2).
render('widget-preview-fed.png', 170, 170, 500, ({ text, rect, header, w }) => {
  return `${header('bottle', 'Last feed', true)}
    ${text(w / 2, 92, '2h 10m', 32, { anchor: 'middle', weight: 600 })}
    ${text(w / 2, 112, 'ago · 1:05 PM', 12, { anchor: 'middle', muted: true })}
    ${rect(14, 130, w - 28, 26, 13, glass)}
    ${text(w / 2, 148, 'Next side: Left', 13, { anchor: 'middle' })}`;
});

// Next sleep (2×2).
render('widget-preview-sleep.png', 170, 170, 500, ({ text, header, w }) => {
  const c = w / 2;
  const cy = 88;
  const r = 42;
  const p = 0.72;
  const a = -Math.PI / 2 + p * 2 * Math.PI;
  return `${header('moon', 'Next sleep', true)}
    <circle cx="${c}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="8"/>
    <path d="M${c} ${cy - r} A${r} ${r} 0 1 1 ${c + r * Math.cos(a)} ${cy + r * Math.sin(a)}" fill="none" stroke="${scene.accent}" stroke-width="8" stroke-linecap="round"/>
    ${text(c, cy + 4, '25m', 22, { anchor: 'middle', weight: 600 })}
    ${text(c, cy + 20, 'at 3:40 PM', 11, { anchor: 'middle', muted: true })}
    ${text(c, 158, 'Awake 1h 05m', 12, { anchor: 'middle', muted: true })}`;
});
