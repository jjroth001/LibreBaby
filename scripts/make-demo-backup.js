/**
 * Writes a LibreBaby backup full of made-up data, for screenshots and demos: "Juniper", born
 * 12 weeks and 3 days before the moment you run this, with two weeks of believable days (naps and
 * night wakings, breast and bottle feeds, diapers, pumping, vitamin D), growth
 * measurements near the WHO median, and her early milestones ticked.
 *
 *   node scripts/make-demo-backup.js demo-backup.json
 *
 * Restore it on a phone or in Expo Go with "Restore from a backup" (Expo Go keeps its own
 * data, separate from an installed LibreBaby). Times are local to this computer, and the
 * last entries are placed shortly before now, so restore it soon after generating.
 */
const fs = require('fs');
const { randomUUID } = require('crypto');

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();

// Seeded, so the same day produces the same data.
let seed = 20261012;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo, hi) => lo + random() * (hi - lo);
const pick = (items) => items[Math.floor(random() * items.length)];

const birth = new Date(now - (12 * 7 + 3) * DAY);
const birthDate = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`;
const child = {
  id: randomUUID(),
  name: 'Juniper',
  birth_date: birthDate,
  sex: 'female',
  created_at: birth.getTime(),
  updated_at: birth.getTime(),
};

const events = [];
function add(type, startAt, endAt, data, notes = null) {
  const at = Math.round(startAt);
  events.push({
    id: randomUUID(),
    child_id: child.id,
    type,
    start_at: at,
    end_at: endAt == null ? null : Math.round(endAt),
    data: JSON.stringify(data),
    notes,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  });
}

let lastSide = 'R';
function feed(at) {
  if (random() < 0.7) {
    // Breastfeed: start on the other side from last time, usually both sides.
    const first = lastSide === 'L' ? 'R' : 'L';
    const firstMs = between(8, 14) * MIN;
    const secondMs = random() < 0.8 ? between(5, 11) * MIN : 0;
    const second = first === 'L' ? 'R' : 'L';
    lastSide = secondMs ? second : first;
    const leftMs = first === 'L' ? firstMs : secondMs;
    const rightMs = first === 'R' ? firstMs : secondMs;
    add('feed_breast', at, at + leftMs + rightMs, {
      side: secondMs ? 'both' : first,
      lastSide,
      leftMs: Math.round(leftMs),
      rightMs: Math.round(rightMs),
      activeSide: null,
      activeSince: null,
    });
    return leftMs + rightMs;
  }
  const oz = pick([3.5, 4, 4, 4.5, 5]);
  add('feed_bottle', at, null, {
    amountMl: Math.round(oz * 29.5735 * 100) / 100,
    content: random() < 0.6 ? 'breast_milk' : 'formula',
  });
  return 15 * MIN;
}

function diaper(at) {
  const dirty = random() < 0.3;
  add('diaper', at, null, { wet: !dirty || random() < 0.6, dirty });
}

const isNight = (ms) => {
  const h = new Date(ms).getHours();
  return h >= 20 || h < 6;
};

// Two weeks of days: awake (feed, maybe a diaper), then sleep; long stretches at night.
const lastWake = now - between(55, 65) * MIN;
let t = new Date(now - 14 * DAY).setHours(6, 10, 0, 0);
while (t < lastWake - 40 * MIN) {
  const fed = feed(t + between(2, 8) * MIN);
  if (random() < 0.85) diaper(t + fed + between(5, 15) * MIN);
  const awake = isNight(t) ? between(30, 50) * MIN : between(70, 100) * MIN;
  const sleepStart = t + awake;
  const sleepMs = isNight(sleepStart) ? between(150, 230) * MIN : between(35, 100) * MIN;
  const sleepEnd = Math.min(sleepStart + sleepMs, lastWake);
  add('sleep', sleepStart, sleepEnd, {});
  t = sleepEnd;
}
// Now: awake for about an hour, just fed, fresh diaper.
feed(now - 48 * MIN);
diaper(now - 22 * MIN);

// Daily vitamin D, and pumping most days.
for (let d = 13; d >= 0; d--) {
  const morning = new Date(now - d * DAY).setHours(9, Math.round(between(0, 40)), 0, 0);
  if (morning < now) add('medication', morning, null, { name: 'Vitamin D', dose: '400 IU' });
  const pumpAt = new Date(now - d * DAY).setHours(21, Math.round(between(0, 50)), 0, 0);
  if (pumpAt < now && random() < 0.8) {
    add('pump', pumpAt, pumpAt + between(12, 20) * MIN, {
      leftMl: Math.round(between(2, 3.5) * 29.5735),
      rightMl: Math.round(between(2, 3.5) * 29.5735),
    });
  }
}

// Growth: a little above the WHO median for girls.
const birthMs = birth.getTime();
for (const [days, weightKg, lengthCm, headCm] of [
  [0, 3.35, 49.8, 34.1],
  [14, 3.72, 51.6, 35.2],
  [31, 4.46, 54.2, 36.7],
  [62, 5.38, 57.9, 38.6],
]) {
  add('growth', birthMs + days * DAY + 10 * HOUR, null, { weightKg, lengthCm, headCm });
}

// Milestones (ids and wording as in src/data/milestones.ts), noticed at plausible ages.
for (const [id, text, weeks] of [
  ['2m-social-2', 'Looks at your face', 3],
  ['2m-social-1', 'Calms down when spoken to or picked up', 3],
  ['2m-language-2', 'Reacts to loud sounds', 4],
  ['2m-movement-2', 'Moves both arms and both legs', 4],
  ['2m-cognitive-1', 'Watches you as you move', 5],
  ['2m-social-4', 'Smiles when you talk to or smile at them', 6],
  ['2m-social-3', 'Seems happy to see you when you walk up', 7],
  ['2m-language-1', 'Makes sounds other than crying', 7],
  ['2m-movement-1', 'Holds head up when on tummy', 8],
  ['2m-cognitive-2', 'Looks at a toy for several seconds', 8],
  ['2m-movement-3', 'Opens hands briefly', 8],
  ['4m-language-1', 'Makes sounds like “oooo”, “aahh” (cooing)', 9],
  ['4m-cognitive-2', 'Looks at their hands with interest', 10],
  ['4m-movement-4', 'Brings hands to mouth', 10],
  ['4m-social-2', 'Chuckles (not yet a full laugh) when you try to make them laugh', 11],
]) {
  add('milestone', birthMs + weeks * 7 * DAY + 15 * HOUR, null, { milestoneId: id, text });
}

events.sort((a, b) => a.start_at - b.start_at);
const backup = {
  app: 'LibreBaby',
  format: 1,
  exportedAt: now,
  children: [child],
  events,
  settings: [{ key: 'volumeUnit', value: '"oz"' }],
};
fs.writeFileSync(process.argv[2] ?? 'demo-backup.json', JSON.stringify(backup));
const count = (type) => events.filter((e) => e.type === type).length;
console.log(
  `wrote ${process.argv[2] ?? 'demo-backup.json'}: Juniper, born ${birthDate};`,
  ['sleep', 'feed_breast', 'feed_bottle', 'diaper', 'pump', 'medication', 'growth', 'milestone']
    .map((t) => `${count(t)} ${t}`)
    .join(', '),
);
