import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { LoadingSpinner } from './LoadingSpinner';

interface ScreenLoaderProps {
  message?: string;
}

export const ScreenLoader: React.FC<ScreenLoaderProps> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <LoadingSpinner size={48} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  text: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
