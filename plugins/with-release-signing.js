/**
 * Signs release builds with LibreBaby's own key instead of React Native's public
 * debug key (which anyone could use to sign a fake "update").
 *
 * The key's location and passwords come from Gradle properties, normally set in
 * ~/.gradle/gradle.properties so they never enter the repo:
 *   LIBREBABY_RELEASE_STORE_FILE, LIBREBABY_RELEASE_STORE_PASSWORD,
 *   LIBREBABY_RELEASE_KEY_ALIAS, LIBREBABY_RELEASE_KEY_PASSWORD
 * Without them, release builds stop with an error rather than quietly falling back to the
 * debug key: a debug-signed APK can't update the installed app and looks like a fake.
 * Debug builds don't need them.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (project.hasProperty('LIBREBABY_RELEASE_STORE_FILE')) {
                storeFile file(LIBREBABY_RELEASE_STORE_FILE)
                storePassword LIBREBABY_RELEASE_STORE_PASSWORD
                keyAlias LIBREBABY_RELEASE_KEY_ALIAS
                keyPassword LIBREBABY_RELEASE_KEY_PASSWORD
            }
        }`;

// Fails before any work starts if a release package is about to be built without the key.
const RELEASE_GUARD = `

// Added by plugins/with-release-signing.js
gradle.taskGraph.whenReady { graph ->
    def buildsRelease = graph.allTasks.any { it.project == project && it.name ==~ /package.*Release/ }
    if (buildsRelease && !project.hasProperty('LIBREBABY_RELEASE_STORE_FILE')) {
        throw new GradleException(
            "LibreBaby release builds must be signed with the LibreBaby release key, but " +
            "LIBREBABY_RELEASE_STORE_FILE isn't set. Add the LIBREBABY_RELEASE_* properties " +
            "to ~/.gradle/gradle.properties (see plugins/with-release-signing.js)."
        )
    }
}
`;

/** Rewrites app/build.gradle's contents; exported for the tests. */
function applyReleaseSigning(gradle) {
  if (gradle.includes('LIBREBABY_RELEASE_STORE_FILE')) return gradle;

  const signingConfigs = /signingConfigs \{/;
  // The release *build type* (inside buildTypes), not any other block named "release".
  const releaseUsesDebug =
    /(buildTypes \{[\s\S]*?\n\s*release \{[^}]*?)signingConfig signingConfigs\.debug/;
  if (!signingConfigs.test(gradle) || !releaseUsesDebug.test(gradle)) {
    throw new Error('with-release-signing: app/build.gradle layout changed; update the plugin.');
  }

  // Point the release build type at our key first, then add the key's signing config.
  gradle = gradle.replace(releaseUsesDebug, '$1signingConfig signingConfigs.release');
  gradle = gradle.replace(signingConfigs, (match) => match + RELEASE_CONFIG);
  return gradle + RELEASE_GUARD;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applyReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.applyReleaseSigning = applyReleaseSigning;
