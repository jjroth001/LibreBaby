import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Leave room for the bottom tab bar. */
  withTabBar?: boolean;
  /** The screen has a navigation header, which already covers the status bar. */
  belowHeader?: boolean;
  ref?: Ref<ScrollView>;
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
};

/** Scrollable page container that respects the status bar and (optionally) the tab bar. */
export function Screen({
  children,
  withTabBar = true,
  belowHeader = false,
  ref,
  onContentSizeChange,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        ref={ref}
        onContentSizeChange={onContentSizeChange}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (belowHeader ? 0 : insets.top) + Spacing.four,
            paddingBottom: insets.bottom + (withTabBar ? BottomTabInset : 0) + Spacing.four,
          },
        ]}>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
});
