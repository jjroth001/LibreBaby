import {
  DAILY_HORIZON_DAYS,
  describeSchedule,
  planMedReminders,
  prefillFromReminder,
  withAfterDoseChoice,
  type MedReminder,
} from './med-reminders';

const HOUR = 3_600_000;
// A made-up afternoon, local time.
const NOW = new Date(2031, 2, 4, 14, 0).getTime();

function reminder(overrides: Partial<MedReminder>): MedReminder {
  return {
    id: 'r1',
    name: 'Sunny Drops',
    dose: '1 drop',
    enabled: true,
    kind: 'after',
    hours: 6,
    times: [],
    ...overrides,
  };
}

describe('planMedReminders, after each dose', () => {
  it('fires the set hours after the latest dose, matching names loosely', () => {
    const last = new Map([['sunny drops', NOW - 2 * HOUR]]);
    const planned = planMedReminders([reminder({ name: ' sunny DROPS ' })], last, NOW);
    expect(planned).toHaveLength(1);
    expect(planned[0].at).toBe(NOW + 4 * HOUR);
    expect(planned[0].id).toBe('med-r1-0');
    expect(planned[0].title).toBe('Time for sunny DROPS');
    expect(planned[0].body).toMatch(/^1 drop · last given 6h ago/);
  });

  it('waits for a first dose, and skips a time already past', () => {
    expect(planMedReminders([reminder({})], new Map(), NOW)).toEqual([]);
    const old = new Map([['sunny drops', NOW - 7 * HOUR]]);
    expect(planMedReminders([reminder({})], old, NOW)).toEqual([]);
  });

  it('ignores reminders that are switched off or nameless', () => {
    const last = new Map([['sunny drops', NOW - HOUR]]);
    expect(planMedReminders([reminder({ enabled: false })], last, NOW)).toEqual([]);
    expect(planMedReminders([reminder({ name: '  ' })], last, NOW)).toEqual([]);
  });
});

describe('planMedReminders, set times', () => {
  const daily = reminder({ kind: 'times', times: [20 * 60, 8 * 60] });

  it('schedules each time for the next two weeks, starting with the next one', () => {
    const planned = planMedReminders([daily], new Map(), NOW);
    const first = new Date(planned[0].at);
    expect([first.getDate(), first.getHours()]).toEqual([4, 20]); // today 8 PM; 8 AM has passed
    expect(planned).toHaveLength(2 * DAILY_HORIZON_DAYS + 1);
    expect(new Set(planned.map((p) => p.id)).size).toBe(planned.length);
    expect(planned[0].body).toBe('1 drop');
  });

  it('skips a time right after a logged dose', () => {
    const givenEarly = new Map([['sunny drops', new Date(2031, 2, 4, 19, 30).getTime()]]);
    const planned = planMedReminders([daily], givenEarly, NOW - HOUR);
    const first = new Date(planned[0].at);
    expect([first.getDate(), first.getHours()]).toEqual([5, 8]);
  });

  it('keeps local wall-clock times across a daylight-saving change', () => {
    const planned = planMedReminders(
      [reminder({ kind: 'times', times: [8 * 60] })],
      new Map(),
      NOW,
    );
    for (const p of planned) expect(new Date(p.at).getHours()).toBe(8);
  });
});

describe('describeSchedule', () => {
  it('reads naturally', () => {
    expect(describeSchedule(reminder({}))).toBe('6 h after each dose');
    expect(describeSchedule(reminder({ kind: 'times', times: [] }))).toBe('No times set');
    expect(describeSchedule(reminder({ kind: 'times', times: [480] }))).toMatch(
      /^Every day at 8:00/,
    );
    expect(describeSchedule(reminder({ kind: 'times', times: [1200, 480, 720] }))).toMatch(
      /^Every day at 8:00.*, 12:00.* and 8:00/,
    );
  });
});

describe('withAfterDoseChoice', () => {
  const dose = { name: 'Sunny Drops', dose: '2 drops' };
  const newId = () => 'new';

  it('adds a reminder when switched on for a new medicine', () => {
    expect(withAfterDoseChoice([], dose, { on: true, hours: 4 }, newId)).toEqual([
      reminder({ id: 'new', dose: '2 drops', hours: 4 }),
    ]);
  });

  it('updates the existing one, keeping its dose if none was typed', () => {
    const list = [reminder({ enabled: false })];
    const next = withAfterDoseChoice(
      list,
      { name: 'sunny drops', dose: '' },
      { on: true, hours: 8 },
      newId,
    );
    expect(next).toEqual([reminder({ hours: 8 })]);
  });

  it('switches an existing reminder off, and otherwise changes nothing', () => {
    expect(withAfterDoseChoice([reminder({})], dose, { on: false, hours: 6 }, newId)).toEqual([
      reminder({ enabled: false }),
    ]);
    expect(withAfterDoseChoice([], dose, { on: false, hours: 6 }, newId)).toBeNull();
    expect(
      withAfterDoseChoice([reminder({ enabled: false })], dose, { on: false, hours: 6 }, newId),
    ).toBeNull();
  });

  it('leaves daily reminders for the same medicine alone', () => {
    const daily = reminder({ id: 'd', kind: 'times', times: [480] });
    const next = withAfterDoseChoice([daily], dose, { on: true, hours: 6 }, newId);
    expect(next).toEqual([daily, reminder({ id: 'new', dose: '2 drops' })]);
  });
});

describe('prefillFromReminder', () => {
  const reminders = [reminder({ id: 'r1', name: ' Sunny Drops ', dose: '1 drop' })];

  it('fills in the medicine from this phone’s own reminder', () => {
    expect(prefillFromReminder(reminders, 'r1')).toEqual({ name: 'Sunny Drops', dose: '1 drop' });
  });

  it('leaves the form empty for an unknown or missing id', () => {
    expect(prefillFromReminder(reminders, 'nope')).toEqual({ name: '', dose: '' });
    expect(prefillFromReminder(reminders, undefined)).toEqual({ name: '', dose: '' });
    expect(prefillFromReminder(reminders, '')).toEqual({ name: '', dose: '' });
  });

  it('is what a planned notification points at', () => {
    const [planned] = planMedReminders(reminders, new Map([['sunny drops', NOW - HOUR]]), NOW);
    expect(planned.reminderId).toBe('r1');
  });
});
