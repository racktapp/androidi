import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Typography } from '@/constants/theme';
import { getAvatarUrl, generateInitials } from '@/utils/getAvatarUrl';

interface UserAvatarProps {
  /** User ID (optional, not used for rendering but can be used for debugging) */
  userId?: string;
  /** Display name or username */
  name?: string | null;
  /** Avatar URL from database (can be full URL or storage path) */
  avatarUrl?: string | null;
  /** Size in pixels */
  size?: number;
  /** Optional border color */
  ringColor?: string;
  /** Optional style overrides */
  style?: ViewStyle;
}

/**
 * UserAvatar - Single source of truth for all avatar rendering
 * 
 * Behavior:
 * 1. If avatarUrl exists → render image with circle mask
 * 2. If image fails to load → fallback to initials
 * 3. If no avatarUrl → render initials directly
 * 
 * Initials logic:
 * - First 2 characters of name (trimmed, uppercase)
 * - If no name provided, shows "??"
 * - Never shows hardcoded "RA", "@", or other placeholders
 */
export function UserAvatar({
  userId,
  name,
  avatarUrl,
  size = 40,
  ringColor,
  style,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Convert avatar_url to displayable URL
  const displayUrl = getAvatarUrl(avatarUrl);

  // Generate initials from name
  const initials = generateInitials(name, name);

  const borderRadius = size / 2;
  const fontSize = Math.round(size * 0.4);

  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius,
      borderColor: ringColor || Colors.primary + '40',
    },
    style,
  ];

  // Show image if available and not errored
  if (displayUrl && !imageError) {
    return (
      <Image
        source={{ uri: displayUrl }}
        style={[containerStyle, styles.image]}
        contentFit="cover"
        transition={200}
        onError={() => {
          console.log('[UserAvatar] Image load failed:', displayUrl);
          setImageError(true);
        }}
      />
    );
  }

  // Fallback to initials
  return (
    <View style={containerStyle}>
      <Text style={[styles.initialsText, { fontSize }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: Colors.surfaceElevated,
  },
  initialsText: {
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
});
