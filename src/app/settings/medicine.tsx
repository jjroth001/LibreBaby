import { MedRemindersSection } from '@/components/settings/med-reminders-section';
import { SettingsPage } from '@/components/settings/settings-page';

export default function MedicineReminderSettings() {
  return (
    <SettingsPage>
      {({ child, settings }) => <MedRemindersSection child={child} settings={settings} />}
    </SettingsPage>
  );
}
