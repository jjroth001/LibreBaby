const app = require('../app.json');

/**
 * Permissions that native code asks Android for as soon as the app starts. Blocking one of
 * them in app.json removes it from the manifest, and the request then throws and closes the
 * app on the splash screen — what happened in 1.14.0.
 */
const NEEDED_AT_START = [
  // expo-screen-capture registers a screenshot callback on start on Android 14+ (it's how
  // the family code is hidden from screenshots). Normal permission: no prompt.
  'android.permission.DETECT_SCREEN_CAPTURE',
];

describe('app.json permissions', () => {
  it('never blocks a permission the app needs to start', () => {
    const blocked = app.expo.android.blockedPermissions ?? [];
    for (const permission of NEEDED_AT_START) expect(blocked).not.toContain(permission);
  });
});
