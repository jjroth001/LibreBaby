import { useIsFocused } from 'expo-router';

import { BACKGROUND_RERUN_DELAY_MS, type DbQueryOptions } from '@/db/use-db-query';

/**
 * Query options for a tab screen: while another tab is in front, its live queries wait
 * until a just-saved entry's screen has closed; as soon as it comes into view, any waiting
 * update runs right away.
 */
export function useTabQueryOptions(): DbQueryOptions {
  const focused = useIsFocused();
  return { rerunDelayMs: focused ? undefined : BACKGROUND_RERUN_DELAY_MS };
}
