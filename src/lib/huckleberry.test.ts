import { parseCsv } from './csv';
import { parseHuckleberryCsv, parseLength, parseVolume, parseWeight } from './huckleberry';
import { ML_PER_OZ } from './units';

const MIN = 60_000;
const local = (s: string) => {
  const [d, t] = s.split(' ');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(y, mo - 1, day, h, mi).getTime();
};

// Made-up rows in Huckleberry's export format (not real data).
const HEADER =
  '"Type","Start","End","Duration","Start Condition","Start Location","End Condition","Notes","Logged By"';
const sample = [
  HEADER,
  '"Feed","2026-01-10 02:47","2026-01-10 03:11","00:23",,"Breast","00:23L",,',
  '"Feed","2026-01-10 06:00","2026-01-10 06:25","00:21","00:07R","Breast","00:14L",,',
  '"Feed","2026-01-10 09:00","2026-01-10 09:20","00:20","00:00R","Breast","00:00L",,',
  '"Sleep","2026-01-09 23:17","2026-01-10 02:30","03:13","10-20_minutes, happy","Worn or held","Upset","No arm swaddle",',
  '"Diaper","2026-01-10 03:29",,"yellow","Pebbles",,"Both, pee:large poo:small",,',
  '"Diaper","2026-01-10 03:29",,,,,"Pee",,',
  '"Pump","2026-01-10 03:16","2026-01-10 03:19","00:03","0oz",,"2.5oz",,',
  '"Meds","2026-01-10 10:13",,,"0.5ml","Vitamin D",,,',
  '"Growth","2026-01-05 14:07",,,"13.03lbs.oz","2.04ft.in","40cm",,',
  '"Bath","2026-01-01 20:30",,,,,,,',
  '"Tummy time","2026-01-01 09:00",,,,,,,',
  '"Sleep","not a date","2026-01-10 02:30",,,,,,',
].join('\r\n');

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, empty fields and a BOM', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi""",\r\n1,,3,\n')).toEqual([
      ['a', 'b, c', 'say "hi"', ''],
      ['1', '', '3', ''],
    ]);
  });
});

describe('unit readers', () => {
  it('reads Huckleberry decimal pounds and feet despite the lbs.oz / ft.in labels', () => {
    expect(parseWeight('8.88lbs.oz')).toBeCloseTo(8.88 * 0.45359237, 6);
    expect(parseWeight('8lbs.oz')).toBeCloseTo(8 * 0.45359237, 6);
    expect(parseWeight('5.2kg')).toBe(5.2);
    expect(parseLength('1.92ft.in')).toBeCloseTo(1.92 * 30.48, 6);
    expect(parseLength('12.99in')).toBeCloseTo(12.99 * 2.54, 6);
    expect(parseLength('40cm')).toBe(40);
    expect(parseVolume('1.25oz')).toBeCloseTo(1.25 * ML_PER_OZ, 6);
    expect(parseVolume('30ml')).toBe(30);
    expect(parseWeight('heavy')).toBeNull();
  });
});

describe('parseHuckleberryCsv', () => {
  const result = parseHuckleberryCsv(sample);
  const byKey = new Map(result.events.map((e) => [e.sourceKey, e]));

  it('rejects files that are not Huckleberry exports', () => {
    expect(() => parseHuckleberryCsv('Date,Amount\n2026-01-01,3')).toThrow(/Huckleberry export/);
  });

  it('reads breastfeeds with per-side minutes', () => {
    expect(byKey.get('Feed|2026-01-10 02:47')).toMatchObject({
      type: 'feed_breast',
      startAt: local('2026-01-10 02:47'),
      endAt: local('2026-01-10 03:11'),
      data: { leftMs: 23 * MIN, rightMs: 0, side: 'L', lastSide: 'L' },
    });
    expect(byKey.get('Feed|2026-01-10 06:00')?.data).toMatchObject({
      leftMs: 14 * MIN,
      rightMs: 7 * MIN,
      side: 'both',
      lastSide: 'L', // longer side, since Huckleberry doesn't say which came last
    });
  });

  it('reads sleep across midnight and keeps the extra details as notes', () => {
    expect(byKey.get('Sleep|2026-01-09 23:17')).toMatchObject({
      type: 'sleep',
      endAt: local('2026-01-10 02:30'),
      notes:
        'Falling asleep: 10-20 minutes, happy · Where: Worn or held · Waking: Upset · No arm swaddle',
    });
  });

  it('reads diapers, keeping color, consistency and sizes, and separates same-minute ones', () => {
    expect(byKey.get('Diaper|2026-01-10 03:29')).toMatchObject({
      data: { wet: true, dirty: true },
      notes: 'yellow · Pebbles · pee large poo small',
    });
    expect(byKey.get('Diaper|2026-01-10 03:29#2')).toMatchObject({
      data: { wet: true, dirty: false },
    });
  });

  it('reads pumping, medication and growth', () => {
    expect(byKey.get('Pump|2026-01-10 03:16')).toMatchObject({
      type: 'pump',
      endAt: local('2026-01-10 03:19'),
    });
    // Start Condition is the left side, End Condition the right ("0oz" … "2.5oz").
    const pump = byKey.get('Pump|2026-01-10 03:16')!;
    if (pump.type !== 'pump') throw new Error('expected pump');
    expect(pump.data.leftMl).toBe(0);
    expect(pump.data.rightMl).toBeCloseTo(2.5 * ML_PER_OZ, 6);

    expect(byKey.get('Meds|2026-01-10 10:13')).toMatchObject({
      type: 'medication',
      data: { name: 'Vitamin D', dose: '0.5ml' },
    });
    const growth = byKey.get('Growth|2026-01-05 14:07')!;
    if (growth.type !== 'growth') throw new Error('expected growth');
    expect(growth.data.weightKg).toBeCloseTo(13.03 * 0.45359237, 6);
    expect(growth.data.lengthCm).toBeCloseTo(2.04 * 30.48, 6);
    expect(growth.data.headCm).toBe(40);
  });

  it('skips and reports what it cannot import', () => {
    expect(result.skipped).toEqual({
      'Breastfeeds with no time on either side': 1,
      'Bath (not tracked in LibreBaby)': 1,
      'Tummy time (not tracked in LibreBaby)': 1,
      'Entries with an unreadable date': 1,
    });
    expect(result.counts).toEqual({
      feed_breast: 2,
      sleep: 1,
      diaper: 2,
      pump: 1,
      medication: 1,
      growth: 1,
    });
  });
});
