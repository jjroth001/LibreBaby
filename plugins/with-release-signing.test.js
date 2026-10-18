const { applyReleaseSigning } = require('./with-release-signing');

// The parts of Expo's generated android/app/build.gradle that the plugin rewrites.
const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

describe('with-release-signing', () => {
  const out = applyReleaseSigning(TEMPLATE);

  it('signs release builds only with the release key', () => {
    expect(out).toMatch(
      /release \{\n\s*\/\/ Caution[^\n]*\n\s*signingConfig signingConfigs\.release\n/,
    );
    expect(out).not.toMatch(/\? signingConfigs\.release : signingConfigs\.debug/);
    expect(out).toContain('storeFile file(LIBREBABY_RELEASE_STORE_FILE)');
  });

  it('keeps debug builds on the debug key', () => {
    expect(out).toMatch(/debug \{\n\s*signingConfig signingConfigs\.debug\n/);
  });

  it('stops release builds when the key is not configured', () => {
    expect(out).toContain('gradle.taskGraph.whenReady');
    expect(out).toMatch(/package\.\*Release/);
    expect(out).toContain('throw new GradleException');
  });

  it('runs only once', () => {
    expect(applyReleaseSigning(out)).toBe(out);
  });

  it('refuses a build.gradle it does not recognise', () => {
    expect(() => applyReleaseSigning('android {}')).toThrow(/layout changed/);
  });
});
