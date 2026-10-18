import { DataSection } from '@/components/settings/data-section';
import { SettingsPage } from '@/components/settings/settings-page';

export default function DataSettings() {
  return (
    <SettingsPage>
      {({ child, settings }) => (
        <DataSection
          child={child}
          unit={settings.volumeUnit}
          growthUnits={settings.growthUnits}
          lastBackupAt={settings.lastBackupAt}
        />
      )}
    </SettingsPage>
  );
}
