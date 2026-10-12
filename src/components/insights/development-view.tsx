import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Card } from '@/components/card';
import { CardTitle } from '@/components/card-title';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icons/icon';
import { ThemedText } from '@/components/themed-text';
import { Motion } from '@/constants/motion';
import { Fonts, InkOnWhite, Spacing } from '@/constants/theme';
import { AREA_NAMES, CHECKLISTS, type Milestone, type MilestoneArea } from '@/data/milestones';
import { ageNote, ageNoteKey } from '@/data/weekly';
import { deleteEvent, insertEventNow, listEventsOfType } from '@/db/events';
import type { BabyEvent, Child } from '@/db/types';
import { useDbQuery } from '@/db/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { ageInDays, formatAge, formatLongDate, toLocalDateString } from '@/lib/dates';
import { checklistProgress, noticedMilestones, upcomingChecklist } from '@/lib/development';
import { successFeedback, tapFeedback } from '@/lib/haptics';

const CDC_URL = 'https://www.cdc.gov/act-early/milestones/index.html';
const AREAS: MilestoneArea[] = ['social', 'language', 'cognitive', 'movement'];

type NoteKey = { kind: 'week' | 'month'; n: number };

/** Step through the notes: weeks 0–51, then months 12–35. */
function stepNote(key: NoteKey, delta: 1 | -1): NoteKey | null {
  if (key.kind === 'week') {
    const n = key.n + delta;
    if (n < 0) return null;
    return n > 51 ? { kind: 'month', n: 12 } : { kind: 'week', n };
  }
  const n = key.n + delta;
  if (n > 35) return null;
  return n < 12 ? { kind: 'week', n: 51 } : { kind: 'month', n };
}

const noteLabel = (key: NoteKey) => (key.kind === 'week' ? `Week ${key.n + 1}` : `${key.n} months`);

/**
 * Insights › Development: the note for this week (browsable), and CDC milestone
 * checklists to tick off as they happen.
 */
export function DevelopmentView({ child, now }: { child: Child; now: number }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const ageDays = ageInDays(child.birthDate, new Date(now));
  const currentKey = ageNoteKey(ageDays);
  const [noteKey, setNoteKey] = useState<NoteKey>(currentKey);
  const current = upcomingChecklist(ageDays);
  const [months, setMonths] = useState(current.months);
  const checklist = CHECKLISTS.find((c) => c.months === months) ?? current;

  const events = useDbQuery(['event'], (db) => listEventsOfType(db, child.id, 'milestone'), [
    child.id,
  ]);
  if (events.status !== 'success') return null;
  const noticed = noticedMilestones(events.data);
  const note = ageNote(noteKey);
  const isCurrentNote = noteKey.kind === currentKey.kind && noteKey.n === currentKey.n;

  const toggle = async (milestone: Milestone, entry: BabyEvent<'milestone'> | undefined) => {
    if (entry) {
      tapFeedback();
      await deleteEvent(db, entry.id);
      return;
    }
    await insertEventNow(db, {
      childId: child.id,
      type: 'milestone',
      data: { milestoneId: milestone.id, text: milestone.text },
    });
    successFeedback();
  };

  const browse = (delta: 1 | -1) => {
    const next = stepNote(noteKey, delta);
    if (next) {
      tapFeedback();
      setNoteKey(next);
    }
  };

  const { done, total } = checklistProgress(checklist, noticed);
  const past = checklist.months < current.months;

  return (
    <View style={styles.sections}>
      {/* This week */}
      <Card style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
            {isCurrentNote
              ? `${noteLabel(noteKey).toUpperCase()} · NOW`
              : noteLabel(noteKey).toUpperCase()}
          </ThemedText>
          <View style={styles.arrows}>
            {([-1, 1] as const).map((delta) => {
              const target = stepNote(noteKey, delta);
              return (
                <Pressable
                  key={delta}
                  accessibilityRole="button"
                  accessibilityLabel={delta < 0 ? 'Previous' : 'Next'}
                  disabled={!target}
                  onPress={() => browse(delta)}
                  style={({ pressed }) => [
                    styles.arrow,
                    { backgroundColor: theme.backgroundElement },
                    !target && styles.disabled,
                    pressed && styles.arrowPressed,
                  ]}>
                  <Icon
                    name={delta < 0 ? 'caret-left' : 'caret-right'}
                    size={18}
                    color={theme.text}
                    duotone={false}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
        <Animated.View
          key={`${noteKey.kind}${noteKey.n}`}
          entering={Motion.fadeIn}
          style={styles.noteBody}>
          <ThemedText style={styles.noteTitle}>{note.title}</ThemedText>
          <ThemedText style={styles.noteText}>{note.body}</ThemedText>
          {note.tip && (
            <View style={[styles.tip, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="sparkle" size={18} color={theme.accent} />
              <ThemedText type="small" style={styles.tipText}>
                {note.tip}
              </ThemedText>
            </View>
          )}
        </Animated.View>
        {!isCurrentNote && (
          <Pressable accessibilityRole="button" onPress={() => setNoteKey(currentKey)}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Back to {child.name}’s age now ({formatAge(child.birthDate, new Date(now))})
            </ThemedText>
          </Pressable>
        )}
      </Card>

      {/* Checklist ages */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.ages}>
        {CHECKLISTS.map((c) => {
          const selected = c.months === months;
          const progress = checklistProgress(c, noticed);
          const label = c.months < 24 ? `${c.months} mo` : `${c.months / 12} yr`;
          return (
            <Pressable
              key={c.months}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Milestones by ${c.months} months, ${progress.done} of ${progress.total} noticed`}
              onPress={() => {
                tapFeedback();
                setMonths(c.months);
              }}>
              {selected ? (
                <View style={[styles.age, styles.ageSelected]}>
                  <ThemedText style={[styles.ageText, { color: InkOnWhite }]}>{label}</ThemedText>
                </View>
              ) : (
                <Glass radius={20} blur={false} flat style={styles.age}>
                  <ThemedText style={styles.ageText}>
                    {label}
                    {progress.done === progress.total ? ' ✓' : ''}
                  </ThemedText>
                </Glass>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* The checklist */}
      <Animated.View key={months} entering={Motion.fadeIn} style={styles.sections}>
        <Card>
          <CardTitle icon="sparkle">
            {past
              ? `Most children do these by ${checklist.months} months`
              : checklist.months === current.months
                ? `What to look for by ${checklist.months} months`
                : `Coming later: by ${checklist.months} months`}
          </CardTitle>
          <ThemedText type="small" themeColor="textSecondary">
            {done} of {total} noticed. Tap one when you see it; tap again to undo. It’s also added
            to the timeline, where you can change the date.
          </ThemedText>
          {AREAS.map((area) => {
            const items = checklist.milestones.filter((m) => m.area === area);
            if (items.length === 0) return null;
            return (
              <View key={area} style={styles.area}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {AREA_NAMES[area]}
                </ThemedText>
                {items.map((milestone) => {
                  const entry = noticed.get(milestone.id);
                  return (
                    <Pressable
                      key={milestone.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: !!entry }}
                      onPress={() => toggle(milestone, entry)}
                      onLongPress={() =>
                        entry && router.push({ pathname: '/event/[id]', params: { id: entry.id } })
                      }
                      style={({ pressed }) => [
                        styles.item,
                        pressed && { backgroundColor: theme.backgroundSelected },
                      ]}>
                      <View
                        style={[
                          styles.check,
                          entry
                            ? { backgroundColor: theme.accent, borderColor: theme.accent }
                            : { borderColor: theme.textSecondary },
                        ]}>
                        {entry && (
                          <Icon
                            name="check"
                            size={16}
                            color={theme.light ? '#FFFFFF' : InkOnWhite}
                            duotone={false}
                          />
                        )}
                      </View>
                      <View style={styles.itemText}>
                        <ThemedText>{milestone.text}</ThemedText>
                        {entry && (
                          <ThemedText type="small" themeColor="textSecondary">
                            Noticed {formatLongDate(toLocalDateString(new Date(entry.startAt)))}
                          </ThemedText>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </Card>

        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            These are things most children (3 in 4) do by this age. Every child develops at their
            own pace, and missing one isn’t a diagnosis. If your child hasn’t reached one or more,
            has lost skills they once had, or you’re worried, don’t wait: talk with your child’s
            doctor and ask about developmental screening. If your baby was born more than 3 weeks
            early, count their age from the due date.
          </ThemedText>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(CDC_URL)}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              Milestones: CDC “Learn the Signs. Act Early.” (with the AAP)
            </ThemedText>
          </Pressable>
        </Card>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  noteCard: { padding: Spacing.four, gap: Spacing.three },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  eyebrow: { flex: 1, fontSize: 11, lineHeight: 16, letterSpacing: 1.2 },
  arrows: { flexDirection: 'row', gap: Spacing.two },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowPressed: { opacity: 0.7 },
  noteTitle: { fontFamily: Fonts.serif, fontSize: 26, lineHeight: 32, fontWeight: 400 },
  noteText: { fontSize: 15, lineHeight: 23 },
  noteBody: { gap: Spacing.two + 2 },
  tip: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 18,
    alignItems: 'flex-start',
  },
  tipText: { flex: 1 },
  disabled: { opacity: 0.3 },
  ages: { gap: Spacing.two, paddingVertical: Spacing.one },
  age: { paddingHorizontal: Spacing.three, height: 40, justifyContent: 'center' },
  ageSelected: { borderRadius: 20, backgroundColor: '#FFFFFF' },
  ageText: { fontSize: 14, lineHeight: 18, fontWeight: 600 },
  sections: { gap: Spacing.four },
  area: { gap: Spacing.one },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemText: { flex: 1, gap: Spacing.half },
});
