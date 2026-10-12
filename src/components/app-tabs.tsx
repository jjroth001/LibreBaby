import TopTabs from 'expo-router/js-top-tabs';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

function tabIcon(name: AndroidSymbol) {
  return function TabIcon({ color }: { color: string }) {
    return <SymbolView name={{ android: name }} tintColor={color} size={24} />;
  };
}

/**
 * Bottom tabs built on a pager, so Home / Timeline / Insights / Settings slide left and right
 * when tapped and can be swiped between. (Android's native tab bar can't swipe.)
 */
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <TopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarShowIcon: true,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarPressColor: theme.backgroundSelected,
        tabBarStyle: {
          backgroundColor: theme.background,
          paddingBottom: insets.bottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.backgroundSelected,
          elevation: 0,
          shadowOpacity: 0,
        },
        // With the bar at the bottom, show the sliding indicator along its top edge.
        tabBarIndicatorStyle: { backgroundColor: theme.tint, top: 0, height: 3 },
        tabBarLabelStyle: { textTransform: 'none', fontSize: 13, fontWeight: 600 },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <TopTabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <TopTabs.Screen
        name="timeline"
        options={{ title: 'Timeline', tabBarIcon: tabIcon('schedule') }}
      />
      <TopTabs.Screen
        name="insights"
        options={{ title: 'Insights', tabBarIcon: tabIcon('bar_chart') }}
      />
      <TopTabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }}
      />
    </TopTabs>
  );
}
