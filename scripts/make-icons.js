/**
 * Generates LibreBaby's app icon, adaptive-icon layers, monochrome (themed) icon,
 * splash image and favicon from one SVG drawing.
 *
 *   npm install --no-save @resvg/resvg-js@2.6.2
 *   node scripts/make-icons.js assets/images [--preview]
 *
 * --preview also writes preview.png showing launcher masks and small sizes (don't commit it).
 */
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const NIGHT = '#2B3A8F';
const MOON = '#FFE7A3';
const SPARK = '#FFFFFF';

const sparkle = (x, y, s) =>
  `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;

/** Crescent + two sparkles, centered in a 1024 box; fits Android's adaptive-icon safe circle. */
function art(moon, spark) {
  return `<g transform="translate(526 512) scale(1.06) translate(-512 -512)">
    <mask id="cut"><rect width="1024" height="1024" fill="white"/><circle cx="585" cy="440" r="200" fill="black"/></mask>
    <circle cx="470" cy="530" r="230" fill="${moon}" mask="url(#cut)"/>
    <path d="${sparkle(680, 385, 72)}" fill="${spark}"/>
    <path d="${sparkle(772, 560, 34)}" fill="${spark}"/></g>`;
}

const svg = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${
    bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''
  }${body}</svg>`;

const files = {
  'icon.png': svg(art(MOON, SPARK), NIGHT),
  'android-icon-foreground.png': svg(art(MOON, SPARK)),
  'android-icon-background.png': svg('', NIGHT),
  'android-icon-monochrome.png': svg(art('#FFFFFF', '#FFFFFF')),
  'splash-icon.png': svg(art(MOON, SPARK)),
};

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const render = (s, width) => new Resvg(s, { fitTo: { mode: 'width', value: width } }).render().asPng();
for (const [name, s] of Object.entries(files)) fs.writeFileSync(path.join(out, name), render(s, 1024));
fs.writeFileSync(path.join(out, 'favicon.png'), render(files['icon.png'], 48));

if (process.argv.includes('--preview')) {
  // How launchers show it: circle and rounded-square masks at 66% safe zone, plus small sizes.
  const fg = art(MOON, SPARK);
  const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420">
    <rect width="1200" height="420" fill="#ECECEC"/><rect x="600" width="600" height="420" fill="#111"/>
    <defs><clipPath id="c"><circle cx="512" cy="512" r="512"/></clipPath>
      <clipPath id="r"><rect width="1024" height="1024" rx="230"/></clipPath></defs>
    <g transform="translate(40,60) scale(0.29)"><g clip-path="url(#c)"><rect width="1024" height="1024" fill="${NIGHT}"/>${fg}</g></g>
    <g transform="translate(360,60) scale(0.29)"><g clip-path="url(#r)"><rect width="1024" height="1024" fill="${NIGHT}"/>${fg}</g></g>
    <g transform="translate(80,360) scale(0.047)"><g clip-path="url(#c)"><rect width="1024" height="1024" fill="${NIGHT}"/>${fg}</g></g>
    <g transform="translate(680,60) scale(0.29)"><g clip-path="url(#c)"><rect width="1024" height="1024" fill="${NIGHT}"/>${fg}</g></g>
    <g transform="translate(960,90) scale(0.2)"><rect width="1024" height="1024" fill="${NIGHT}"/>${art('#FFFFFF', '#FFFFFF')}</g>
  </svg>`;
  fs.writeFileSync(path.join(out, 'preview.png'), new Resvg(preview).render().asPng());
}
console.log('wrote', fs.readdirSync(out).join(', '));
