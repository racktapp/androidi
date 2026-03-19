import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd as NativeBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { logStartup } from '@/utils/startupDiagnostics';

const PROD_BANNER_IDS: Record<'ios' | 'android', string> = {
  ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  android: 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
};

export function AdMobBanner() {
  const adComponents = useMemo(() => {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      return {
        BannerAd: NativeBannerAd as React.ComponentType<any>,
        BannerAdSize,
        TestIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown module load error';
      logStartup(`[AdMobBanner] native ads unavailable, rendering placeholder: ${message}`);
      return null;
    }
  }, []);

  if (!adComponents?.BannerAd) {
    return <View style={styles.placeholder} />;
  }

  const unitId = __DEV__
    ? adComponents.TestIds?.BANNER
    : PROD_BANNER_IDS[Platform.OS as 'ios' | 'android'];

  if (!unitId) {
    return <View style={styles.placeholder} />;
  }

  const BannerAd = adComponents.BannerAd;
  const bannerSize = adComponents.BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? 'BANNER';

  return (
    <View style={styles.bannerContainer}>
      <BannerAd unitId={unitId} size={bannerSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    minHeight: 50,
  },
  placeholder: {
    minHeight: 1,
  },
});
