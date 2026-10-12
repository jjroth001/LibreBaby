import { getSettings } from './settings';
import { useDbQuery } from './use-db-query';

export function useSettings() {
  return useDbQuery(['setting'], getSettings);
}
