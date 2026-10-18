import { SettingsPage } from '@/components/settings/settings-page';
import { SyncSection } from '@/components/settings/sync-section';

export default function FamilySyncSettings() {
  return <SettingsPage>{({ child }) => <SyncSection child={child} />}</SettingsPage>;
}
