import { CHECKLISTS, type MilestoneChecklist } from '@/data/milestones';
import type { BabyEvent } from '@/db/types';

const DAYS_PER_MONTH = 30.4375;

export const ageInMonths = (ageDays: number) => ageDays / DAYS_PER_MONTH;

/**
 * The checklist to look at now: the next one coming up (“what to look for by 4 months”),
 * or the last one once past three years. The CDC's “by 2 months” means by the end of the
 * second month, so a checklist stays current until the month after its age.
 */
export function upcomingChecklist(ageDays: number): MilestoneChecklist {
  const months = ageInMonths(ageDays);
  return CHECKLISTS.find((c) => months < c.months + 1) ?? CHECKLISTS[CHECKLISTS.length - 1];
}

/** Milestone id → the entry recording it (the earliest, if logged twice, e.g. on two phones). */
export function noticedMilestones(
  events: BabyEvent<'milestone'>[],
): Map<string, BabyEvent<'milestone'>> {
  const noticed = new Map<string, BabyEvent<'milestone'>>();
  for (const event of events) {
    const seen = noticed.get(event.data.milestoneId);
    if (!seen || event.startAt < seen.startAt) noticed.set(event.data.milestoneId, event);
  }
  return noticed;
}

export function checklistProgress(
  checklist: MilestoneChecklist,
  noticed: Map<string, unknown>,
): { done: number; total: number } {
  const done = checklist.milestones.filter((m) => noticed.has(m.id)).length;
  return { done, total: checklist.milestones.length };
}
