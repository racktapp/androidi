import { logStartup } from '@/utils/startupDiagnostics';

let hasInitialized = false;

export async function initAdMob(): Promise<void> {
  if (hasInitialized) {
    return;
  }

  logStartup('[AdMob] skipped on web platform');
  hasInitialized = true;
}
