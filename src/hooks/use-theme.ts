import { usePalette } from '@/components/sky/sky-provider';

/** Colors for the current sky (light text at night, dark text by day). */
export function useTheme() {
  return usePalette();
}
