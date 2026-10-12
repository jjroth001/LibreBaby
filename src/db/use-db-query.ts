import { addDatabaseChangeListener, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState, type DependencyList } from 'react';

type Table = 'child' | 'event' | 'setting';

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
): QueryState<T> {
  const db = useSQLiteContext();
  const [state, setState] = useState<QueryState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });

  useEffect(() => {
    let latestRun = 0;
    let disposed = false;

    const run = () => {
      const thisRun = ++latestRun;
      query(db).then(
        (data) => {
          if (!disposed && thisRun === latestRun) setState({ status: 'success', data, error: undefined });
        },
        (error: Error) => {
          if (!disposed && thisRun === latestRun) setState({ status: 'error', data: undefined, error });
        },
      );
    };

    run();
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if ((tables as readonly string[]).includes(tableName)) run();
    });
    return () => {
      disposed = true;
      subscription.remove();
    };
    // `query` and `tables` are expected to be inline; callers list real inputs in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  return state;
}
