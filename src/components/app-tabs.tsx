import TopTabs from 'expo-router/js-top-tabs';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'house' },
  { name: 'timeline', title: 'Timeline', icon: 'clock' },
  { name: 'oracle', title: 'Oracle', icon: 'crystal-ball' },
  { name: 'insights', title: 'Insights', icon: 'chart-bar' },
  { name: 'settings', title: 'Settings', icon: 'gear' },
];

const BAR_HEIGHT = 58;
const BUBBLE_INSET = 5;

/**
 * Room to leave at the bottom of a tab screen's scrolling content: the tab bar floats over
 * the screen, so the last item can still scroll clear of it.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + Spacing.two + BAR_HEIGHT + Spacing.two;
}

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: object) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  position: Animated.AnimatedInterpolation<number>;
};

/**
 * A floating glass pill over the bottom of the screen. The white "selected" bubble follows the pager while you swipe, so
 * it glides between tabs rather than jumping.
 */
function GlassTabBar({ state, navigation, position }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slot = width / TABS.length;
  const translateX = position.interpolate({
    inputRange: TABS.map((_, i) => i),
    outputRange: TABS.map((_, i) => i * slot),
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.two }]}>
      <Glass
        radius={BAR_HEIGHT / 2}
        style={styles.bar}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              {
                width: slot - BUBBLE_INSET * 2,
                backgroundColor: theme.selected,
                transform: [{ translateX }],
              },
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? theme.onSelected : theme.text;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              style={styles.item}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}>
              <Icon name={tab.icon} size={22} color={color} />
              <Text
                style={[styles.label, { color: focused ? theme.onSelected : theme.textSecondary }]}>
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

/**
 * Tabs built on a pager, so Home / Timeline / Oracle / Insights / Settings slide left and right when
 * tapped and can be swiped between. (Android's native tab bar can't swipe.)
 */
export default function AppTabs() {
  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props: TabBarProps) => <GlassTabBar {...props} />}
      screenOptions={{ sceneStyle: { backgroundColor: 'transparent' } }}>
      {TABS.map((tab) => (
        <TopTabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </TopTabs>
  );
}

const styles = StyleSheet.create({
  // Floats over the screens, so content scrolls underneath instead of stopping at an edge.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    position: 'absolute',
    left: BUBBLE_INSET,
    top: BUBBLE_INSET,
    bottom: BUBBLE_INSET,
    borderRadius: (BAR_HEIGHT - BUBBLE_INSET * 2) / 2,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: { fontSize: 11, fontWeight: 600 },
});
