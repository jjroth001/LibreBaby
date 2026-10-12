export type Child = {
  id: string;
  name: string;
  /** Local calendar date, YYYY-MM-DD. */
  birthDate: string;
  createdAt: number;
  updatedAt: number;
};

/** Type-specific payload stored in `event.data`. Amounts are always metric. */
export type EventDataMap = {
  sleep: Record<string, never>;
  feed_breast: { side: 'L' | 'R' | 'both'; leftMs: number; rightMs: number };
  feed_bottle: { amountMl: number; content: 'breast_milk' | 'formula' };
  feed_solids: { foods: string[] };
  diaper: { wet: boolean; dirty: boolean };
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
