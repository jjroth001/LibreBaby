import { csvField, toCsv } from '@/lib/csv';

import { openTestDatabase } from '@/test-utils/node-sqlite';

import { importBackup, parseBackup, planEventMerge, type EventRow } from './backup';
import { getSettings } from './settings';

function row(id: string, updatedAt: number): EventRow {
  return {
    id,
    child_id: 'c1',
    type: 'diaper',
    start_at: 0,
    end_at: null,
    data: '{"wet":true,"dirty":false}',
    notes: null,
    created_at: 0,
    updated_at: updatedAt,
    deleted_at: null,
  };
}

const validBackup = {
  app: 'LibreBaby',
  format: 1,
  exportedAt: 1,
  children: [{ id: 'c1', name: 'Ada', birth_date: '2026-06-01', created_at: 1, updated_at: 1 }],
  events: [row('e1', 5)],
  settings: [{ key: 'volumeUnit', value: '"oz"' }],
};

describe('parseBackup', () => {
  it('accepts a valid backup', () => {
    expect(parseBackup(JSON.stringify(validBackup)).events).toHaveLength(1);
  });

  it.each([
    ['not json', /valid JSON/],
    [JSON.stringify({ hello: 'world' }), /isn’t a LibreBaby backup/],
    [JSON.stringify({ ...validBackup, format: 99 }), /newer version/],
    [JSON.stringify({ ...validBackup, events: [{ id: 'e1' }] }), /damaged/],
    [JSON.stringify({ ...validBackup, events: [{ ...row('e1', 5), data: 'oops' }] }), /damaged/],
    [
      JSON.stringify({ ...validBackup, events: [{ ...row('e1', 5), type: 'teleport' }] }),
      /damaged/,
    ],
    [
      JSON.stringify({
        ...validBackup,
        children: [{ ...validBackup.children[0], birth_date: 'soon' }],
      }),
      /damaged/,
    ],
  ])('rejects %s', (text, message) => {
    expect(() => parseBackup(text)).toThrow(message);
  });
});

describe('planEventMerge', () => {
  it('adds new rows, updates newer ones, and leaves the rest', () => {
    const existing = new Map([
      ['old', 10],
      ['same', 10],
      ['stale', 10],
    ]);
    const plan = planEventMerge(existing, [
      row('new', 1),
      row('old', 20),
      row('same', 10),
      row('stale', 5),
    ]);
    expect(plan.toWrite.map((r) => r.id)).toEqual(['new', 'old']);
    expect(plan).toMatchObject({ added: 1, updated: 1, unchanged: 2 });
  });

  it('is a no-op when the same backup is restored twice', () => {
    const rows = [row('a', 1), row('b', 2)];
    const existing = new Map(rows.map((r) => [r.id, r.updated_at]));
    expect(planEventMerge(existing, rows)).toMatchObject({ added: 0, updated: 0, unchanged: 2 });
  });
});

describe('csv', () => {
  it('quotes only when needed', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, b')).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField(null)).toBe('');
  });

  it('builds a UTF-8 CSV Excel can open', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b', null],
      ]),
    ).toBe(`${String.fromCharCode(0xfeff)}a,1\r\nb,\r\n`);
  });
});

describe('importBackup', () => {
  it('dates nothing after now, and imports only settings it knows and can read', async () => {
    const db = openTestDatabase();
    const now = Date.UTC(2026, 9, 1);
    const future = Date.UTC(2100, 0, 1);
    await importBackup(
      db,
      {
        ...(validBackup as any),
        children: [{ ...validBackup.children[0], updated_at: future }],
        events: [row('e1', future)],
        settings: [
          { key: 'volumeUnit', value: '"oz"' },
          { key: 'haptics', value: 'not json' },
          { key: 'madeUp', value: '1' },
        ],
      },
      undefined,
      now,
    );
    expect(await db.getFirstAsync('SELECT updated_at FROM child')).toEqual({ updated_at: now });
    expect(await db.getFirstAsync('SELECT updated_at FROM event')).toEqual({ updated_at: now });
    expect(await db.getAllAsync('SELECT key FROM setting ORDER BY key')).toEqual([
      { key: 'volumeUnit' },
    ]);
  });

  it('falls back to the default for a stored setting it can’t read', async () => {
    const db = openTestDatabase();
    await db.runAsync("INSERT INTO setting (key, value) VALUES ('haptics', 'not json')");
    expect((await getSettings(db)).haptics).toBe(true);
  });
});
