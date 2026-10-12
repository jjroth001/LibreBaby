import type { ImportedEvent } from '@/lib/huckleberry';

import { planHuckleberryImport } from './huckleberry-import';

const MIN = 60_000;

function diaper(sourceKey: string, startAt: number): ImportedEvent {
  return {
    sourceKey,
    type: 'diaper',
    startAt,
    endAt: null,
    data: { wet: true, dirty: false },
    notes: null,
  };
}

describe('planHuckleberryImport', () => {
  const events = [
    diaper('Diaper|a', 0),
    diaper('Diaper|b', 60 * MIN),
    diaper('Diaper|c', 120 * MIN),
  ];

  it('adds everything into an empty app', () => {
    expect(planHuckleberryImport([], events).toAdd).toHaveLength(3);
  });

  it('adds nothing when the same export is imported again', () => {
    const existing = events.map((e) => ({
      id: `huckleberry:${e.sourceKey}`,
      type: e.type,
      start_at: e.startAt,
    }));
    expect(planHuckleberryImport(existing, events)).toMatchObject({
      toAdd: [],
      alreadyImported: 3,
      matchedExisting: 0,
    });
  });

  it('skips entries already logged in LibreBaby around the same time', () => {
    const loggedInLibreBaby = [
      { id: 'abc', type: 'diaper', start_at: 63 * MIN }, // 3 min after "b"
      { id: 'def', type: 'sleep', start_at: 120 * MIN }, // different kind: no match for "c"
    ];
    const plan = planHuckleberryImport(loggedInLibreBaby, events);
    expect(plan.toAdd.map((e) => e.sourceKey)).toEqual(['Diaper|a', 'Diaper|c']);
    expect(plan.matchedExisting).toBe(1);
  });
});
