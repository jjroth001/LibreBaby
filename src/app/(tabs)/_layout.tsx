import AppTabs from '@/components/app-tabs';
import { SleepReminderSync } from '@/components/sleep-reminder-sync';
import { useChild } from '@/db/use-child';

export default function TabsLayout() {
  const { data: child } = useChild();
  return (
    <>
      {child && <SleepReminderSync child={child} />}
      <AppTabs />
    </>
  );
}
