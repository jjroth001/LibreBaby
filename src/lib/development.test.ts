import type { BabyEvent } from '@/db/types';

import { checklistProgress, noticedMilestones, upcomingChecklist } from './development';

const milestone = (id: string, milestoneId: string, startAt: number) =>
  ({
    id,
    childId: 'c',
    type: 'milestone',
    startAt,
    endAt: null,
    data: { milestoneId, text: '' },
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  }) as BabyEvent<'milestone'>;

describe('development', () => {
  it('looks ahead to the next checklist age', () => {
    expect(upcomingChecklist(10).months).toBe(2); // newborn
    expect(upcomingChecklist(61).months).toBe(2); // exactly 2 months
    expect(upcomingChecklist(84).months).toBe(2); // 12 weeks: still within the 2nd month's end
    expect(upcomingChecklist(95).months).toBe(4); // just past 3 months
    expect(upcomingChecklist(400).months).toBe(15);
    expect(upcomingChecklist(2000).months).toBe(36); // past the last one
  });

  it('counts a milestone once, at its earliest entry (e.g. logged on two phones)', () => {
    const noticed = noticedMilestones([
      milestone('b', '2m-social-2', 200),
      milestone('a', '2m-social-2', 100),
      milestone('c', '2m-language-1', 300),
    ]);
    expect(noticed.get('2m-social-2')?.id).toBe('a');
    expect(checklistProgress(upcomingChecklist(30), noticed)).toEqual({ done: 2, total: 11 });
  });
});
