import { Platform } from 'react-native';
import { logStartup, logStartupError } from '@/utils/startupDiagnostics';

let hasInitialized = false;

export async function initAdMob(): Promise<void> {
  if (hasInitialized || Platform.OS === 'web') {
    return;
  }

  try {
    // Use string concatenation to prevent Metro's static analysis from resolving this on web
    const admobModule = require('react-native-google-mobile-' + 'ads');
    const mobileAds = admobModule?.default;

    if (typeof mobileAds === 'function') {
      await mobileAds().initialize();
      logStartup('[AdMob] initialized');
    } else {
      logStartup('[AdMob] module found but initialize unavailable; skipping');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AdMob load error';
    logStartupError(`[AdMob] unavailable in host app, skipping ads: ${message}`);
  } finally {
    hasInitialized = true;
  }
}
