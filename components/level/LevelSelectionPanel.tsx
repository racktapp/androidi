import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Config, Sport } from '@/constants/config';

interface LevelSelectionPanelProps {
  sport: Sport;
  level: number;
  manualMode: boolean;
  manualInput: string;
  onLevelChange: (value: number) => void;
  onManualModeChange: (enabled: boolean) => void;
  onManualInputChange: (value: string) => void;
  manualError?: string;
  reliabilityText: string;
  reliabilitySubtext: string;
  showSportSelector?: boolean;
  onSportChange?: (sport: Sport) => void;
}

const getLevelForChoice = (choice: 'beginner' | 'intermediate' | 'advanced') => {
  return Config.onboardingLevels[choice];
};

export default function LevelSelectionPanel({
  sport,
  level,
  manualMode,
  manualInput,
  onLevelChange,
  onManualModeChange,
  onManualInputChange,
  manualError,
  reliabilityText,
  reliabilitySubtext,
  showSportSelector = false,
  onSportChange,
}: LevelSelectionPanelProps) {
  return (
    <>
      {showSportSelector && onSportChange && (
        <View style={styles.sportSelector}>
          <Pressable
            style={[styles.sportTab, sport === 'tennis' && styles.sportTabActive]}
            onPress={() => onSportChange('tennis')}
          >
            <Image
              source={require('@/assets/icons/tennis_icon.png')}
              style={[styles.sportIconSmall, sport !== 'tennis' && styles.sportIconInactive]}
              contentFit="contain"
              transition={0}
            />
            <Text style={[styles.sportTabText, sport === 'tennis' && styles.sportTabTextActive]}>Tennis</Text>
          </Pressable>

          <Pressable
            style={[styles.sportTab, sport === 'padel' && styles.sportTabActive]}
            onPress={() => onSportChange('padel')}
          >
            <Image
              source={require('@/assets/icons/padel_icon.png')}
              style={[styles.sportIconSmall, sport !== 'padel' && styles.sportIconInactive]}
              contentFit="contain"
              transition={0}
            />
            <Text style={[styles.sportTabText, sport === 'padel' && styles.sportTabTextActive]}>Padel</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.levelsContainer}>
        <Pressable
          style={[
            styles.levelChoice,
            level === getLevelForChoice('beginner') && !manualMode && styles.levelChoiceSelected,
          ]}
          onPress={() => {
            onLevelChange(getLevelForChoice('beginner'));
            onManualModeChange(false);
            onManualInputChange(getLevelForChoice('beginner').toFixed(1));
          }}
        >
          <Text style={styles.levelChoiceTitle}>New / Beginner</Text>
          <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('beginner').toFixed(1)}</Text>
        </Pressable>

        <Pressable
          style={[
            styles.levelChoice,
            level === getLevelForChoice('intermediate') && !manualMode && styles.levelChoiceSelected,
          ]}
          onPress={() => {
            onLevelChange(getLevelForChoice('intermediate'));
            onManualModeChange(false);
            onManualInputChange(getLevelForChoice('intermediate').toFixed(1));
          }}
        >
          <Text style={styles.levelChoiceTitle}>Casual / Intermediate</Text>
          <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('intermediate').toFixed(1)}</Text>
        </Pressable>

        <Pressable
          style={[
            styles.levelChoice,
            level === getLevelForChoice('advanced') && !manualMode && styles.levelChoiceSelected,
          ]}
          onPress={() => {
            onLevelChange(getLevelForChoice('advanced'));
            onManualModeChange(false);
            onManualInputChange(getLevelForChoice('advanced').toFixed(1));
          }}
        >
          <Text style={styles.levelChoiceTitle}>Competitive / Advanced</Text>
          <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('advanced').toFixed(1)}</Text>
        </Pressable>

        <Pressable
          style={styles.manualButton}
          onPress={() => {
            const nextMode = !manualMode;
            onManualModeChange(nextMode);
            if (nextMode) {
              onManualInputChange(level.toFixed(1));
            }
          }}
        >
          <Text style={styles.manualButtonText}>
            {manualMode ? '← Back to presets' : 'I already know my level →'}
          </Text>
        </Pressable>
      </View>

      {manualMode && (
        <View style={styles.manualInputContainer}>
          <Text style={styles.manualLabel}>Enter your level ({Config.rating.min}–{Config.rating.max})</Text>
          <TextInput
            style={styles.manualInput}
            value={manualInput}
            onChangeText={onManualInputChange}
            placeholder="2.5"
            placeholderTextColor={Colors.textDisabled}
            keyboardType="decimal-pad"
            maxLength={3}
          />
          {parseFloat(manualInput) > Config.rating.onboardingMax && !isNaN(parseFloat(manualInput)) && (
            <Text style={styles.warningText}>
              ⚠️ Most players are between {Config.rating.min}–{Config.rating.onboardingMax}, but you can set any level.
            </Text>
          )}
          {manualError && <Text style={styles.errorText}>{manualError}</Text>}
        </View>
      )}

      <View style={styles.currentLevelContainer}>
        <View style={styles.sportIconContainer}>
          <Image
            source={sport === 'tennis' ? require('@/assets/icons/tennis_icon.png') : require('@/assets/icons/padel_icon.png')}
            style={styles.sportIconLarge}
            contentFit="contain"
            transition={200}
          />
        </View>
        <Text style={styles.suggestedLabel}>Your level:</Text>
        <Text style={styles.currentLevelText}>{level.toFixed(1)}</Text>
        <Text style={styles.reliabilityNote}>{reliabilityText}</Text>
        <Text style={styles.reliabilitySubnote}>{reliabilitySubtext}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sportSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
    gap: 2,
  },
  sportTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  sportTabActive: {
    backgroundColor: Colors.accentGold,
    shadowColor: Colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sportTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  sportTabTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  sportIconSmall: {
    width: 20,
    height: 20,
  },
  sportIconInactive: {
    opacity: 0.5,
  },
  levelsContainer: {
    gap: Spacing.md,
  },
  levelChoice: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  levelChoiceSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
  },
  levelChoiceTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  levelChoiceLevel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  manualButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  manualButtonText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  manualInputContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  manualLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  manualInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  warningText: {
    fontSize: Typography.sizes.xs,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  currentLevelContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sportIconContainer: {
    marginBottom: Spacing.sm,
  },
  sportIconLarge: {
    width: 48,
    height: 48,
  },
  suggestedLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  currentLevelText: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  reliabilityNote: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  reliabilitySubnote: {
    fontSize: Typography.sizes.xs,
    color: Colors.textDisabled,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});
