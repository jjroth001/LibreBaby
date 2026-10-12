import TopTabs from 'expo-router/js-top-tabs';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons/icon';
import { InkOnWhite, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'house' },
  { name: 'timeline', title: 'Timeline', icon: 'clock' },
  { name: 'insights', title: 'Insights', icon: 'chart-bar' },
  { name: 'settings', title: 'Settings', icon: 'gear' },
];

const BAR_HEIGHT = 58;
const BUBBLE_INSET = 5;

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: object) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  position: Animated.AnimatedInterpolation<number>;
};

/**
 * A floating glass pill. The white "selected" bubble follows the pager while you swipe, so
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
    <View style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.two }]}>
      <Glass
        radius={BAR_HEIGHT / 2}
        style={styles.bar}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.bubble, { width: slot - BUBBLE_INSET * 2, transform: [{ translateX }] }]}
          />
        )}
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? InkOnWhite : theme.text;
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
              <Text style={[styles.label, { color: focused ? InkOnWhite : theme.textSecondary }]}>
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
 * Tabs built on a pager, so Home / Timeline / Insights / Settings slide left and right when
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
  wrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
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
    backgroundColor: 'rgba(255,255,255,0.92)',
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
