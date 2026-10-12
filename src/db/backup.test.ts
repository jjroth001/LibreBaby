import { csvField, toCsv } from '@/lib/csv';

import { parseBackup, planEventMerge, type EventRow } from './backup';

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
