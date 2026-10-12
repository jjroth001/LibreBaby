// App entry: Expo Router, plus background tasks for the home-screen widget and family sync.
import 'expo-router/entry';

import { isInstalledBuild, widgetsSupported } from './src/lib/platform';

// The widget library is native-only: loading it in Expo Go would crash, so it's required
// lazily and only in installed Android builds. Android runs this handler to draw the
// widget even when the app isn't open.
if (widgetsSupported) {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

// Family sync while the app is closed: the background-sync service runs this task (see
// modules/background-sync). Installed builds only, like the widget.
if (isInstalledBuild) {
  const { AppRegistry } = require('react-native');
  const { backgroundSyncTask } = require('./src/sync/background-task');
  AppRegistry.registerHeadlessTask('LibreBabySync', () => backgroundSyncTask);
}
