const { withAndroidManifest } = require('@expo/config-plugins');

const UNUSED_ANDROID_PERMISSIONS = new Set([
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACTIVITY_RECOGNITION',
  'android.permission.CAMERA',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.READ_CALENDAR',
  'android.permission.READ_CONTACTS',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.RECORD_AUDIO',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.VIBRATE',
  'android.permission.WRITE_CALENDAR',
  'android.permission.WRITE_CONTACTS',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]);

module.exports = function withAndroidPermissionCleanup(config) {
  return withAndroidManifest(config, (currentConfig) => {
    const manifest = currentConfig.modResults;
    const keys = ['uses-permission', 'uses-permission-sdk-23'];

    for (const key of keys) {
      const current = manifest.manifest[key];
      if (!current) continue;

      const permissions = Array.isArray(current) ? current : [current];
      manifest.manifest[key] = permissions.filter((permission) => {
        const name = permission?.$?.['android:name'];
        return !UNUSED_ANDROID_PERMISSIONS.has(name);
      });
    }

    return currentConfig;
  });
};
