import { OracleSection } from '@/components/settings/oracle-section';
import { SettingsPage } from '@/components/settings/settings-page';

export default function OracleSettings() {
  return <SettingsPage>{({ settings }) => <OracleSection settings={settings} />}</SettingsPage>;
}
