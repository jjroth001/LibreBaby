import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icons/icon';
import { AgendaItem } from '@/components/oracle/agenda-item';
import { nowColor } from '@/components/oracle/oracle-style';
import { WhySheet } from '@/components/oracle/why-sheet';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { EventRow } from '@/components/timeline/event-row';
import { Motion } from '@/constants/motion';
import { Fonts, Spacing } from '@/constants/theme';
import { listEvents, TIMER_TYPES } from '@/db/events';
import type { BabyEvent, Child } from '@/db/types';
import { useChild } from '@/db/use-child';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useDbQuery } from '@/db/use-db-query';
import { useTabQueryOptions } from '@/hooks/use-tab-query-options';
import { useSettings } from '@/db/use-settings';
import { useLiveLayout } from '@/hooks/use-live-layout';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { ageInDays, startOfLocalDay } from '@/lib/dates';
import { formatDuration, formatTime } from '@/lib/format';
import { tapFeedback } from '@/lib/haptics';
import {
  buildForecast,
  earlierToday,
  ORACLE_LOOKBACK_DAYS,
  oracleLookbackStart,
  type OracleItem,
} from '@/lib/oracle';

const BADGE_W = 44;

export default function OracleScreen() {
  const { data: child } = useChild();
  // Built just after Home, so the app opens quicker (see useDeferredMount).
  const ready = useDeferredMount(500);
  if (!child || !ready) return null;
  return <Oracle child={child} />;
}

function isRunning(event: BabyEvent): boolean {
  return event.endAt === null && (TIMER_TYPES as readonly string[]).includes(event.type);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function Oracle({ child }: { child: Child }) {
  const theme = useTheme();
  const settings = useSettings();
  const now = useNow(60_000);
  const { layout, resetKey } = useLiveLayout();
  const [showEarlier, setShowEarlier] = useState(false);
  const [selected, setSelected] = useState<OracleItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryOptions = useTabQueryOptions();
  const events = useDbQuery(
    ['event'],
    (db) => listEvents(db, child.id, oracleLookbackStart(Date.now()), Date.now() + 1),
    [child.id],
    queryOptions,
  );

  if (settings.status !== 'success' || events.status !== 'success') return null;

  const logged = events.data.filter((e) => e.startAt <= now);
  const forecast = buildForecast({
    events: logged,
    ageDays: ageInDays(child.birthDate, new Date(now)),
    now,
  });
  const earlier = earlierToday(logged, now);
  const today = startOfLocalDay(now);

  const wake = forecast.items.find((i) => i.kind === 'wake');
  const dayItems = forecast.items.filter((i) => !i.night && (!wake || i.at < wake.at));
  const nightItems = forecast.items.filter((i) => i.night);
  const morningItems = forecast.items.filter((i) => !i.night && wake && i.at >= wake.at);
  const morningDay = wake ? startOfLocalDay(wake.at) : null;

  const open = (item: OracleItem) => {
    tapFeedback();
    setSelected(item);
    setSheetOpen(true);
  };
  const list = (items: OracleItem[]) =>
    items.map((item) => (
      <Animated.View key={item.id} entering={Motion.enter} exiting={Motion.exit} layout={layout}>
        <AgendaItem item={item} onPress={() => open(item)} />
      </Animated.View>
    ));

  const nowLabel =
    forecast.asleepSince != null
      ? `Now ${formatTime(now)} · asleep ${formatDuration(now - forecast.asleepSince)}`
      : forecast.awakeSince != null
        ? `Now ${formatTime(now)} · awake ${formatDuration(now - forecast.awakeSince)}`
        : `Now ${formatTime(now)}`;
  const earlierCount = earlier.sleeps + earlier.feeds + earlier.diapers;

  return (
    <Screen>
      <View style={styles.header} accessibilityRole="header">
        <View style={styles.titleRow}>
          <Icon name="crystal-ball" size={28} color={theme.text} />
          <ThemedText style={styles.title}>The Oracle</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Rest of today and tonight
        </ThemedText>
      </View>

      {forecast.learning && (
        <Card>
          <View style={styles.note}>
            <Icon name="sparkle" size={20} color={theme.accent} />
            <ThemedText type="small" style={styles.noteText}>
              Still learning {child.name}’s rhythm. Until there are a few days of entries, these
              estimates lean on typical ranges for their age.
            </ThemedText>
          </View>
        </Card>
      )}

      <Card style={styles.agenda}>
        <LayoutAnimationConfig key={resetKey} skipEntering skipExiting>
          <Section badge={<DateBadge day={today} today />}>
            {earlierCount > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showEarlier }}
                accessibilityHint={showEarlier ? 'Hides today’s entries' : 'Shows today’s entries'}
                onPress={() => {
                  tapFeedback();
                  setShowEarlier((v) => !v);
                }}
                style={[styles.earlier, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.earlierText}>
                  Earlier · {plural(earlier.sleeps, 'sleep')} · {plural(earlier.feeds, 'feed')} ·{' '}
                  {plural(earlier.diapers, 'diaper')}
                </ThemedText>
                <Chevron open={showEarlier} color={theme.textSecondary} />
              </Pressable>
            )}
            {showEarlier && (
              <Animated.View entering={Motion.enter} exiting={Motion.exit} style={styles.logged}>
                {earlier.events.map((event) => {
                  const running = isRunning(event);
                  return (
                    <EventRow
                      key={event.id}
                      event={event}
                      unit={settings.data.volumeUnit}
                      growthUnits={settings.data.growthUnits}
                      dayStart={today}
                      running={running}
                      onPress={() =>
                        running
                          ? router.navigate('/')
                          : router.push({ pathname: '/event/[id]', params: { id: event.id } })
                      }
                    />
                  );
                })}
              </Animated.View>
            )}
            <Animated.View layout={layout}>
              <NowLine label={nowLabel} />
            </Animated.View>
            {list(dayItems)}
          </Section>

          {nightItems.length > 0 && (
            <Section label="Tonight" icon="moon" layout={layout}>
              {list(nightItems)}
            </Section>
          )}

          {morningItems.length > 0 && morningDay != null && (
            <Section
              label={morningDay === today ? 'This morning' : 'Tomorrow morning'}
              icon="sun"
              layout={layout}
              badge={morningDay !== today ? <DateBadge day={morningDay} /> : undefined}>
              {list(morningItems)}
            </Section>
          )}
        </LayoutAnimationConfig>
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        Estimates come from the last {ORACLE_LOOKBACK_DAYS} days of entries and {child.name}’s age,
        and get better the more you log. Tap one to see why. A rough guide, not medical advice.
      </ThemedText>

      <WhySheet item={selected} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}

/** A stretch of the agenda: an optional date badge on the left, a heading, then items. */
function Section({
  badge,
  label,
  icon,
  layout,
  children,
}: {
  badge?: ReactNode;
  label?: string;
  icon?: IconName;
  layout?: typeof Motion.layout;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Animated.View layout={layout} style={styles.section}>
      <View style={styles.badgeCol}>{badge}</View>
      <View style={styles.sectionBody}>
        {label && (
          <View style={styles.sectionLabel} accessibilityRole="header">
            {icon && <Icon name={icon} size={16} color={theme.textSecondary} duotone={false} />}
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caps}>
              {label.toUpperCase()}
            </ThemedText>
            <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
          </View>
        )}
        {children}
      </View>
    </Animated.View>
  );
}

/** "FRI / 16", with today's date in a filled circle, as in a calendar's agenda. */
function DateBadge({ day, today = false }: { day: number; today?: boolean }) {
  const theme = useTheme();
  const date = new Date(day);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}>
      <ThemedText style={[styles.weekday, { color: today ? theme.tint : theme.textSecondary }]}>
        {weekday}
      </ThemedText>
      <View style={[styles.dayCircle, today && { backgroundColor: theme.tint }]}>
        <ThemedText style={[styles.dayNumber, today && { color: theme.onTint }]}>
          {date.getDate()}
        </ThemedText>
      </View>
    </View>
  );
}

function NowLine({ label }: { label: string }) {
  const theme = useTheme();
  const color = nowColor(theme);
  return (
    <View style={styles.now}>
      <View style={[styles.nowRule, { backgroundColor: color }]} />
      <View style={[styles.nowDot, { backgroundColor: color }]} />
      <View
        style={[
          styles.nowPill,
          { borderColor: color, backgroundColor: theme.simple ? theme.card : theme.surface },
        ]}>
        <ThemedText style={[styles.nowText, { color }]}>{label}</ThemedText>
      </View>
    </View>
  );
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '-90deg' : '90deg', { duration: 200 }) }],
  }));
  return (
    <Animated.View style={style}>
      <Icon name="caret-right" size={16} color={color} duotone={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontFamily: Fonts.serif, fontSize: 28, lineHeight: 36, fontWeight: 400 },
  note: { flexDirection: 'row', gap: Spacing.two + Spacing.one, alignItems: 'flex-start' },
  noteText: { flex: 1 },
  agenda: {
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    gap: Spacing.three,
  },
  section: { flexDirection: 'row', gap: Spacing.two },
  badgeCol: { width: BADGE_W, alignItems: 'center' },
  sectionBody: { flex: 1, gap: Spacing.two },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  caps: { fontSize: 12, letterSpacing: 0.6 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  badge: { alignItems: 'center', gap: Spacing.half },
  weekday: { fontSize: 12, lineHeight: 16, fontWeight: 700 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  earlier: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  earlierText: { flex: 1 },
  logged: { gap: Spacing.half },
  now: { flexDirection: 'row', alignItems: 'center', height: 28, marginVertical: Spacing.one },
  nowDot: { width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
  nowRule: { position: 'absolute', left: 0, right: 0, height: 2 },
  nowPill: {
    marginLeft: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: 2,
  },
  nowText: { fontSize: 13, lineHeight: 18, fontWeight: 700 },
  footer: { textAlign: 'center', paddingHorizontal: Spacing.three },
});
