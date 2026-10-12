export type Sex = 'male' | 'female';

export type Child = {
  id: string;
  name: string;
  /** Local calendar date, YYYY-MM-DD. */
  birthDate: string;
  /** Picks the WHO growth chart; null until the parent sets it. */
  sex: Sex | null;
  createdAt: number;
  updatedAt: number;
};

export type BreastSide = 'L' | 'R';

/** Type-specific payload stored in `event.data`. Amounts are always metric. */
export type EventDataMap = {
  sleep: Record<string, never>;
  feed_breast: {
    /** Which side(s) were used (summary, set when the feed finishes). */
    side: BreastSide | 'both';
    /** The most recent side fed on; the next feed should usually start on the other one. */
    lastSide: BreastSide;
    /** Completed time per side, not counting the segment in progress. */
    leftMs: number;
    rightMs: number;
    /** While the timer runs: the side being fed and since when. Null when paused or finished. */
    activeSide: BreastSide | null;
    activeSince: number | null;
  };
  feed_bottle: { amountMl: number; content: 'breast_milk' | 'formula' };
  feed_solids: { foods: string[] };
  diaper: { wet: boolean; dirty: boolean };
  /** `dose` is free text as written on the label, e.g. "2.5 ml" or "1 drop"; may be empty. */
  medication: { name: string; dose: string };
  /** A pumping session; its duration is `endAt - startAt`. */
  pump: { leftMl: number; rightMl: number };
  /** Any combination of measurements taken at once; metric, null when not measured. */
  growth: { weightKg: number | null; lengthCm: number | null; headCm: number | null };
};

export type EventType = keyof EventDataMap;

type EventOf<T extends EventType> = {
  id: string;
  childId: string;
  type: T;
  /** Unix ms. */
  startAt: number;
  /** Unix ms; null while a timer is running or for instantaneous events. */
  endAt: number | null;
  data: EventDataMap[T];
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

/** Discriminated union: narrowing on `type` narrows `data`. */
export type BabyEvent<T extends EventType = EventType> = { [K in T]: EventOf<K> }[T];

export type NewEvent<T extends EventType = EventType> = {
  [K in T]: Pick<EventOf<K>, 'childId' | 'type' | 'startAt' | 'data'> &
    Partial<Pick<EventOf<K>, 'endAt' | 'notes'>>;
}[T];
