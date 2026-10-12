// App entry: Expo Router, plus the home-screen widget's background task.
import 'expo-router/entry';

import { widgetsSupported } from './src/lib/platform';

// The widget library is native-only: loading it in Expo Go would crash, so it's required
// lazily and only in installed Android builds. Android runs this handler to draw the
// widget even when the app isn't open.
if (widgetsSupported) {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
