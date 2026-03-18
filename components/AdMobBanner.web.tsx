import React from 'react';
import { View } from 'react-native';

// Web platform does not support AdMob
// This component renders nothing on web
export function AdMobBanner() {
  return <View />;
}
