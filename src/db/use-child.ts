import { getChild } from './children';
import { useDbQuery } from './use-db-query';

/** The (single, in v1) child profile, kept live as it changes. */
export function useChild() {
  return useDbQuery(['child'], getChild);
}
