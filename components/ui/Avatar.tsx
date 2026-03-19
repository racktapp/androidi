import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Typography } from '@/constants/theme';

interface AvatarProps {
  imageUrl?: string | null;
  initials?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

const SIZES = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const FONT_SIZES = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 32,
};

export function Avatar({ imageUrl, initials = 'RA', size = 'md', style }: AvatarProps) {
  const dimension = SIZES[size];
  const fontSize = FONT_SIZES[size];
  const displayInitials = (initials || 'RA').toUpperCase().slice(0, 2);

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          { width: dimension, height: dimension, borderRadius: dimension / 2 },
          style,
        ]}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View
      style={[
        styles.initialsContainer,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.initialsText, { fontSize }]}>{displayInitials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: Colors.surfaceElevated,
  },
  initialsContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.primary + '40', // 25% opacity
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
});
