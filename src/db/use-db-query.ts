import { addDatabaseChangeListener, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useRef, useState, type DependencyList } from 'react';

import { onDbChanged } from './db-changes';

type Table = 'child' | 'event' | 'setting' | 'sync_peer';

const RERUN_DELAY_MS = 30;

/**
 * For queries nobody is looking at right now (widgets, notifications, a tab off screen):
 * re-run after the screen that made the change has finished closing, so the two don't
 * compete for the same moment and the closing animation stays smooth.
 */
export const BACKGROUND_RERUN_DELAY_MS = 700;

export type DbQueryOptions = {
  /** How long after a change to re-run (default: right away, ~30 ms). */
  rerunDelayMs?: number;
};

type QueryState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

/**
 * Runs `query` and re-runs it whenever any of `tables` changes, so screens stay
 * live without manual refreshes. Requires the provider to be opened with
 * `enableChangeListener: true`.
 */
export function useDbQuery<T>(
  tables: readonly Table[],
  query: (db: SQLiteDatabase) => Promise<T>,
  deps: DependencyList = [],
  options: DbQueryOptions = {},
): QueryState<T> {
  const db = useSQLiteContext();
  const [state, setState] = useState<QueryState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });
  const delayMs = options.rerunDelayMs ?? RERUN_DELAY_MS;
  // Read when a change arrives, so a new delay doesn't re-subscribe (or re-query).
  const delayRef = useRef(delayMs);
  // Runs a waiting re-query now (set by the effect below).
  const flushRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const sooner = delayMs < delayRef.current;
    delayRef.current = delayMs;
    // e.g. a tab coming into view with a change still waiting: show it now.
    if (sooner) flushRef.current?.();
  }, [delayMs]);

  useEffect(() => {
    let latestRun = 0;
    let disposed = false;

    const run = () => {
      const thisRun = ++latestRun;
      query(db).then(
        (data) => {
          if (!disposed && thisRun === latestRun)
            setState({ status: 'success', data, error: undefined });
        },
        (error: Error) => {
          if (!disposed && thisRun === latestRun)
            setState({ status: 'error', data: undefined, error });
        },
      );
    };

    run();
    // The listener fires once per changed row; a restore can write thousands. Coalesce a
    // burst into a single re-query shortly after it ends.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const rerunFor = (tableName: string) => {
      if (!(tables as readonly string[]).includes(tableName)) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        pending = undefined;
        run();
      }, delayRef.current);
    };
    flushRef.current = () => {
      if (pending === undefined) return;
      clearTimeout(pending);
      pending = undefined;
      run();
    };
    const subscription = addDatabaseChangeListener(({ tableName }) => rerunFor(tableName));
    // Writes from another connection (the widget) say so once they've committed.
    const nudges = onDbChanged((changed) => changed.forEach(rerunFor));
    return () => {
      disposed = true;
      clearTimeout(pending);
      flushRef.current = null;
      subscription.remove();
      nudges.remove();
    };
    // `query` and `tables` are expected to be inline; callers list real inputs in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  return state;
}
