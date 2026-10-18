/**
 * Turns off Android's automatic cloud backup ("Backup by Google One") for LibreBaby.
 *
 * Without this, Android quietly copies the app's files, including the database with the
 * whole baby log, to the Google account's Drive every day. LibreBaby promises the data
 * stays on the family's phones, so it opts out; families keep their own backups with
 * Settings → Back up, and phones in a family copy each other through sync.
 *
 * Moving to a new phone with a cable or Android's "copy from old phone" is separate from
 * cloud backup and keeps working (expo-secure-store's rules still keep the family key out
 * of it, so the new phone joins the family again with the family code).
 */
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withNoCloudBackup(config) {
  // Expo writes android:allowBackup from this setting.
  config.android = { ...config.android, allowBackup: false };
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:allowBackup'] = 'false';
    return cfg;
  });
};
