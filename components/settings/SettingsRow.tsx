import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';

interface SettingsRowProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  toggle = false,
  toggleValue = false,
  onToggle,
  danger = false,
  disabled = false,
}: SettingsRowProps) {
  const content = (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      {icon && (
        <MaterialIcons
          name={icon}
          size={24}
          color={danger ? Colors.danger : Colors.textMuted}
        />
      )}
      <View style={styles.textContainer}>
        <Text style={[styles.title, danger && styles.titleDanger]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
          thumbColor={Colors.textPrimary}
          disabled={disabled}
        />
      ) : showChevron && (
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={Colors.textMuted}
        />
      )}
    </View>
  );

  if (toggle || !onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        pressed && styles.rowPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  textContainer: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  titleDanger: {
    color: Colors.danger,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
});
