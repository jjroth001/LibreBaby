import { SCENES } from './sky';
import { skySvg } from './sky-svg';

describe('skySvg', () => {
  it('draws a crescent moon and stars at night, clouds by day', () => {
    const night = skySvg(SCENES.night, 400, 800);
    expect(night.match(/<circle/g)!.length).toBe(46); // stars; the moon is a crescent path
    expect(night).toMatch(/<path d="M[\d.]+,[\d.]+ A/);
    expect(night).not.toContain('<ellipse');
    const day = skySvg(SCENES.day, 400, 800);
    expect(day).toContain('<ellipse');
    expect(day).not.toContain('opacity="0.35"'); // no stars
  });

  it('is a well-formed document with numbers only (no NaN)', () => {
    for (const scene of Object.values(SCENES)) {
      const svg = skySvg(scene, 393, 851);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });
});
