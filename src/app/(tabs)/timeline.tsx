import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function TimelineScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Timeline</ThemedText>
      <ThemedText themeColor="textSecondary">
        Your day at a glance will show up here once logging is in (M3).
      </ThemedText>
    </Screen>
  );
}
