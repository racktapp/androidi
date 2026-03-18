const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withRemoveReadMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    const remove = new Set([
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
    ]);

    const keys = ["uses-permission", "uses-permission-sdk-23"];
    for (const key of keys) {
      const current = manifest.manifest[key];
      if (!current) continue;

      const arr = Array.isArray(current) ? current : [current];
      manifest.manifest[key] = arr.filter((p) => {
        const name = p?.$?.["android:name"];
        return !remove.has(name);
      });
    }

    return config;
  });
};