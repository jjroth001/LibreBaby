import { CHECKLISTS, milestoneById } from './milestones';
import { ageNote, ageNoteKey, MONTHS, WEEKS } from './weekly';

const WORDS: Record<string, number> = { One: 1, Two: 2, Three: 3, Four: 4, Six: 6, Nine: 9 };

describe('weekly notes', () => {
  it('cover every week of the first year and every month to three', () => {
    expect(WEEKS).toHaveLength(52);
    for (let m = 12; m <= 35; m++) expect(MONTHS[m]).toBeDefined();
    for (const note of [...WEEKS, ...Object.values(MONTHS)]) {
      expect(note.title.length).toBeGreaterThan(0);
      expect(note.body.length).toBeGreaterThan(40);
    }
  });

  it('only say "N months" in a week when the baby really is N months old', () => {
    WEEKS.forEach((note, week) => {
      const match = /^(\w+) months?$/.exec(note.title);
      if (!match || !(match[1] in WORDS)) return;
      const monthsAtStart = (week * 7) / 30.4375;
      expect([week, Math.round(monthsAtStart)]).toEqual([week, WORDS[match[1]]]);
      expect(monthsAtStart).toBeGreaterThanOrEqual(WORDS[match[1]] - 0.25);
    });
  });

  it('picks the week in the first year, then the month, up to three years', () => {
    expect(ageNoteKey(0)).toEqual({ kind: 'week', n: 0 });
    expect(ageNoteKey(84)).toEqual({ kind: 'week', n: 12 });
    expect(ageNoteKey(365)).toEqual({ kind: 'month', n: 12 });
    expect(ageNoteKey(5000)).toEqual({ kind: 'month', n: 35 });
    expect(ageNote(ageNoteKey(400)).title).toBeTruthy();
  });
});

describe('milestones', () => {
  it('has unique, stable ids', () => {
    const ids = CHECKLISTS.flatMap((c) => c.milestones.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(milestoneById('2m-social-2')?.text).toBe('Looks at your face');
  });

  it('follows the CDC ages, in order', () => {
    expect(CHECKLISTS.map((c) => c.months)).toEqual([2, 4, 6, 9, 12, 15, 18, 24, 30, 36]);
  });
});
