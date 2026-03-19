import { Platform } from 'react-native';
import { initAdMob as initNativeAdMob } from './admob.native';
import { initAdMob as initWebAdMob } from './admob.web';

export const initAdMob = Platform.OS === 'web' ? initWebAdMob : initNativeAdMob;
