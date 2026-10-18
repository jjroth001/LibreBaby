import type { ReactNode } from 'react';

import { Screen } from '@/components/screen';
import type { Settings } from '@/db/settings';
import type { Child } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useSettings } from '@/db/use-settings';

type Loaded = { child: Child; settings: Settings };

/** One page of Settings, opened from its menu row: the header names it, below is the content. */
export function SettingsPage({ children }: { children: (loaded: Loaded) => ReactNode }) {
  const { data: child } = useChild();
  const { data: settings } = useSettings();
  if (!child || !settings) return null;
  return (
    <Screen withTabBar={false} belowHeader>
      {children({ child, settings })}
    </Screen>
  );
}
