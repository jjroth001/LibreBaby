/**
 * A nudge for the app's live queries after another connection has committed a write.
 *
 * SQLite's change listener fires while a write is still in progress. For the app's own
 * connection that's fine (its next query waits for the write), but a write on a separate
 * connection — like the widget's button taps — may not be committed yet when screens
 * re-query, so they read the old data and never hear about the commit. Calling
 * `notifyDbChanged` once the write has finished makes them read again.
 */
type Listener = (tables: readonly string[]) => void;

const listeners = new Set<Listener>();

export function notifyDbChanged(tables: readonly string[]) {
  for (const listener of listeners) listener(tables);
}

export function onDbChanged(listener: Listener): { remove: () => void } {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
}
