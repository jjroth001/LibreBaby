import type { ComponentRef, ReactNode, Ref } from 'react';
import { StyleSheet, type ScrollView, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/app-tabs';
import { Card } from '@/components/card';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Leave room for the bottom tab bar. */
  withTabBar?: boolean;
  /** The screen has a navigation header, which already covers the status bar. */
  belowHeader?: boolean;
  /** Put the content on one glass panel (forms and other single-purpose screens). */
  panel?: boolean;
  ref?: Ref<ScrollView>;
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
  /** Pull to refresh. */
  refreshControl?: ScrollViewProps['refreshControl'];
};

/** Scrollable page container that respects the status bar and (optionally) the tab bar. */
export function Screen({
  children,
  withTabBar = true,
  belowHeader = false,
  panel = false,
  ref,
  onContentSizeChange,
  refreshControl,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();

  return (
    <ThemedView style={styles.container}>
      {/* Scrolls the focused field clear of the keyboard, in step with its animation. */}
      <KeyboardAwareScrollView
        // Its ref is the underlying ScrollView with one extra method, which callers don't use.
        ref={ref as Ref<ComponentRef<typeof KeyboardAwareScrollView>>}
        bottomOffset={Spacing.four}
        onContentSizeChange={onContentSizeChange}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (belowHeader ? 0 : insets.top) + Spacing.four,
            // The tab bar floats over the bottom, so leave room to scroll clear of it.
            paddingBottom: (withTabBar ? tabBarSpace : insets.bottom) + Spacing.four,
          },
        ]}>
        {panel ? <Card style={styles.panel}>{children}</Card> : children}
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  panel: { gap: Spacing.four },
});
