/**
 * Renders the widget-picker preview (assets/images/widget-preview.png): a mock of the
 * LibreBaby widget with sample data. Same setup as make-icons.js:
 *   npm install --no-save @resvg/resvg-js@2.6.2
 *   node scripts/make-widget-preview.js assets/images/widget-preview.png
 */
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const NIGHT = '#2B3A8F', MOON = '#FFE7A3', TEXT = '#FFFFFF', MUTED = '#C9D1F2';
const row = (y, label, value) => `
  <text x="40" y="${y}" font-size="30" fill="${MUTED}">${label}</text>
  <text x="270" y="${y}" font-size="34" font-weight="600" fill="${TEXT}">${value}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="440" viewBox="0 0 1000 440" font-family="Segoe UI, Roboto, Arial, sans-serif">
  <rect width="1000" height="440" rx="60" fill="${NIGHT}"/>
  <mask id="cut"><rect width="100" height="100" fill="white"/><circle cx="62" cy="38" r="20" fill="black"/></mask>
  <g transform="translate(26,30)"><circle cx="50" cy="50" r="24" fill="${MOON}" mask="url(#cut)"/></g>
  <text x="112" y="95" font-size="38" font-weight="700" fill="${MOON}">Baby</text>
  ${row(195, 'Last feed', '2:10 PM  ·  Bottle · 4 oz formula')}
  ${row(290, 'Next sleep', '3:40 PM – 4:10 PM')}
  ${row(385, 'Last diaper', '12:30 PM  ·  Wet diaper')}
</svg>`;
fs.writeFileSync(process.argv[2], new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'width', value: 1000 } }).render().asPng());
console.log('wrote', process.argv[2]);
