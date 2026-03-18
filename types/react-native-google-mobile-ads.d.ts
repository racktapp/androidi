declare module 'react-native-google-mobile-ads' {
  export const TestIds: {
    BANNER: string;
  };

  export enum BannerAdSize {
    ANCHORED_ADAPTIVE_BANNER = 'ANCHORED_ADAPTIVE_BANNER',
  }

  export const AdsConsent: {
    gatherConsent(): Promise<{ canRequestAds: boolean }>;
  };

  export function BannerAd(props: { unitId: string; size: BannerAdSize | string }): JSX.Element;

  export default function mobileAds(): {
    initialize(): Promise<unknown>;
  };
}
