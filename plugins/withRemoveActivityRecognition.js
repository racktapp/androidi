const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withRemoveActivityRecognition(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    const keys = ["uses-permission", "uses-permission-sdk-23"];
    for (const key of keys) {
      const current = manifest.manifest[key];
      if (!current) continue;

      const arr = Array.isArray(current) ? current : [current];
      manifest.manifest[key] = arr.filter(
        (p) => p?.$?.["android:name"] !== "android.permission.ACTIVITY_RECOGNITION"
      );
    }

    return config;
  });
};