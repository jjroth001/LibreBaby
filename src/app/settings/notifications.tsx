import { NotificationsSection } from '@/components/settings/notifications-section';
import { SettingsPage } from '@/components/settings/settings-page';

export default function NotificationSettings() {
  return (
    <SettingsPage>
      {({ child, settings }) => <NotificationsSection child={child} settings={settings} />}
    </SettingsPage>
  );
}
