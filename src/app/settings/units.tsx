import { SettingsPage } from '@/components/settings/settings-page';
import { UnitsSection } from '@/components/settings/units-section';

export default function UnitsSettings() {
  return <SettingsPage>{({ settings }) => <UnitsSection settings={settings} />}</SettingsPage>;
}
