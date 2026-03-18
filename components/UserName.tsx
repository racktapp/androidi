import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography } from '@/constants/theme';
import { getUserLabel } from '@/utils/getUserLabel';

interface UserNameProps {
  /** User profile object */
  profile?: any;
  /** Show handle below display name (default: false) */
  showHandle?: boolean;
  /** Custom display name style */
  displayNameStyle?: TextStyle;
  /** Custom handle style */
  handleStyle?: TextStyle;
  /** Container style */
  style?: ViewStyle;
  /** Number of lines for display name (default: 1) */
  numberOfLines?: number;
}

/**
 * UserName - Single source of truth for rendering user names
 * 
 * Features:
 * - Consistent fallback logic via getUserLabel utility
 * - Supports both camelCase and snake_case profile fields
 * - Primary text: display name (never empty)
 * - Secondary text: @handle (optional)
 * 
 * Usage:
 * ```tsx
 * <UserName profile={user} showHandle />
 * <UserName profile={friend} showHandle={false} />
 * ```
 */
export function UserName({
  profile,
  showHandle = false,
  displayNameStyle,
  handleStyle,
  style,
  numberOfLines = 1,
}: UserNameProps) {
  const { displayName, handle } = getUserLabel(profile);

  if (!showHandle) {
    return (
      <Text 
        style={[styles.displayName, displayNameStyle]} 
        numberOfLines={numberOfLines}
      >
        {displayName}
      </Text>
    );
  }

  return (
    <View style={style}>
      <Text 
        style={[styles.displayName, displayNameStyle]} 
        numberOfLines={numberOfLines}
      >
        {displayName}
      </Text>
      {handle && (
        <Text style={[styles.handle, handleStyle]} numberOfLines={1}>
          {handle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  displayName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  handle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
