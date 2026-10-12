import type { Scene } from './sky';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A rolling hill silhouette whose crest sits near `y` (all in px), filling to the bottom. */
function hill(color: string, y: number, seed: number, w: number, h: number) {
  const sx = w / 360;
  const a = y - (30 + (seed % 3) * 8) * (h / 760);
  const b = y + 20 * (h / 760);
  return (
    `<path d="M0,${r1(y)} C${r1(70 * sx)},${r1(a)} ${r1(120 * sx)},${r1(b)} ${r1(190 * sx)},${r1(y - 10)} ` +
    `S${r1(300 * sx)},${r1(a + 10)} ${w},${r1(y + 5)} L${w},${h} L0,${h} Z" fill="${color}"/>`
  );
}

/**
 * A crescent moon: the disc at (x, y) radius r, minus a slightly smaller disc offset toward
 * the upper right — drawn as one path so the glow and stars show through the "missing" part.
 */
function crescent(x: number, y: number, r: number) {
  const [ox, oy, inner] = [0.46 * r, -0.35 * r, 0.92 * r];
  const d = Math.hypot(ox, oy);
  const a = (d * d + r * r - inner * inner) / (2 * d);
  const h = Math.sqrt(r * r - a * a);
  const [ux, uy] = [ox / d, oy / d];
  const p1 = [x + a * ux - h * uy, y + a * uy + h * ux].map(r1);
  const p2 = [x + a * ux + h * uy, y + a * uy - h * ux].map(r1);
  return `M${p1} A${r1(r)},${r1(r)} 0 1 1 ${p2} A${r1(inner)},${r1(inner)} 0 0 0 ${p1} Z`;
}

/**
 * The sky as an SVG document, `w`×`h` px: gradient, stars, sun/moon glow, clouds, mist and
 * three hills. One renderer for the app background and the home-screen widget.
 */
export function skySvg(scene: Scene, w: number, h: number): string {
  const { sky, glow, body, mist, hills } = scene;
  const unit = w; // sizes (glow, sun) scale with width so they look the same on any phone
  let s =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${sky[0]}"/><stop offset="0.5" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/>` +
    `</linearGradient>` +
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${glow.color}" stop-opacity="${glow.opacity}"/><stop offset="1" stop-color="${glow.color}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${mist.color}" stop-opacity="0"/><stop offset="0.5" stop-color="${mist.color}" stop-opacity="${mist.opacity}"/><stop offset="1" stop-color="${mist.color}" stop-opacity="0"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>`;

  if (scene.stars > 0.02) {
    for (let i = 0; i < 46; i++) {
      const x = ((i * 97) % 360) * (w / 360);
      const y = (((i * 53) % 420) + 10) * (h / 760);
      const opacity = (0.35 + (i % 4) * 0.15) * scene.stars;
      s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${i % 5 ? 0.9 : 1.6}" fill="#FFFFFF" opacity="${r1(opacity * 100) / 100}"/>`;
    }
  }

  const gx = glow.x * w;
  const gy = glow.y * h;
  const gr = glow.r * unit;
  s += `<rect x="${r1(gx - gr)}" y="${r1(gy - gr)}" width="${r1(gr * 2)}" height="${r1(gr * 2)}" fill="url(#glow)"/>`;

  const bx = body.x * w;
  const by = body.y * h;
  const br = body.r * unit;
  s +=
    body.kind === 'moon'
      ? `<path d="${crescent(bx, by, br)}" fill="${body.color}"/>`
      : `<circle cx="${r1(bx)}" cy="${r1(by)}" r="${r1(br)}" fill="${body.color}"/>`;

  if (scene.clouds > 0.02) {
    const sx = w / 360;
    const sy = h / 760;
    s += `<g fill="#FFFFFF" opacity="${r1(0.9 * scene.clouds * 100) / 100}">`;
    for (const [cx, cy, rx, ry] of [
      [70, 300, 80, 20],
      [110, 286, 46, 26],
      [290, 360, 70, 16],
      [262, 350, 36, 20],
    ]) {
      s += `<ellipse cx="${r1(cx * sx)}" cy="${r1(cy * sy)}" rx="${r1(rx * sx)}" ry="${r1(ry * sx)}"/>`;
    }
    s += `</g>`;
  }

  [0.62, 0.71, 0.8].forEach((fraction, i) => {
    const y = fraction * h;
    s += hill(hills[i], y, i, w, h);
    if (i === 0) {
      s += `<rect y="${r1(y - (40 * h) / 760)}" width="${w}" height="${r1((120 * h) / 760)}" fill="url(#mist)"/>`;
    }
  });
  return s + '</svg>';
}
