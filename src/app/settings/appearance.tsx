import { AppearanceSection } from '@/components/settings/appearance-section';
import { SettingsPage } from '@/components/settings/settings-page';

export default function AppearanceSettings() {
  return <SettingsPage>{({ settings }) => <AppearanceSection settings={settings} />}</SettingsPage>;
}
