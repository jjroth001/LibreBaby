import AppTabs from '@/components/app-tabs';
import { MedReminderSync } from '@/components/med-reminder-sync';
import { SleepReminderSync } from '@/components/sleep-reminder-sync';
import { useChild } from '@/db/use-child';

export default function TabsLayout() {
  const { data: child } = useChild();
  return (
    <>
      {child && <SleepReminderSync child={child} />}
      {child && <MedReminderSync child={child} />}
      <AppTabs />
    </>
  );
}
