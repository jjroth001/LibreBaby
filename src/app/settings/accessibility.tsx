import { AccessibilitySection } from '@/components/settings/accessibility-section';
import { SettingsPage } from '@/components/settings/settings-page';

export default function AccessibilitySettings() {
  return (
    <SettingsPage>{({ settings }) => <AccessibilitySection settings={settings} />}</SettingsPage>
  );
}
