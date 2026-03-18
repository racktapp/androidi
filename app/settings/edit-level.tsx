import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button } from '@/components';
import { Sport, Config } from '@/constants/config';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

interface UserRating {
  id: string;
  sport: Sport;
  level: number;
  reliability: number;
  matchesPlayed: number;
}

export default function EditLevelScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport>('tennis');
  const [ratings, setRatings] = useState<Record<Sport, UserRating | null>>({
    tennis: null,
    padel: null,
  });

  const [level, setLevel] = useState(2.5);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('2.5');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadRatings();
    }
  }, [userId]);

  useEffect(() => {
    // When sport changes, update level from that sport's rating
    const sportRating = ratings[selectedSport];
    if (sportRating) {
      setLevel(sportRating.level);
      setManualInput(sportRating.level.toFixed(1));
    }
  }, [selectedSport, ratings]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadRatings = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_ratings')
        .select('id, sport, level, reliability, matches_played')
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading ratings:', error);
        setLoading(false);
        return;
      }

      const ratingsMap: Record<Sport, UserRating | null> = {
        tennis: null,
        padel: null,
      };

      data?.forEach((rating: any) => {
        ratingsMap[rating.sport as Sport] = {
          id: rating.id,
          sport: rating.sport,
          level: rating.level,
          reliability: rating.reliability,
          matchesPlayed: rating.matches_played,
        };
      });

      setRatings(ratingsMap);

      // Set initial level from first available sport
      const initialSport = ratingsMap.tennis || ratingsMap.padel;
      if (initialSport) {
        setLevel(initialSport.level);
        setManualInput(initialSport.level.toFixed(1));
        setSelectedSport(initialSport.sport);
      }
    } catch (err) {
      console.error('Error loading ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  const getLevelForChoice = (choice: 'beginner' | 'intermediate' | 'advanced') => {
    return Config.onboardingLevels[choice];
  };

  const handleManualInput = (value: string) => {
    setManualInput(value);
    const parsed = parseFloat(value);
    
    if (!isNaN(parsed)) {
      const clamped = Math.max(Config.rating.min, Math.min(Config.rating.max, parsed));
      setLevel(Number(clamped.toFixed(1)));
    }
  };

  const handleSave = async () => {
    // Validation
    if (manualMode) {
      const parsed = parseFloat(manualInput);
      if (isNaN(parsed)) {
        setErrors({ manual: 'Please enter a valid number' });
        return;
      }
      const clamped = Math.max(Config.rating.min, Math.min(Config.rating.max, parsed));
      setLevel(Number(clamped.toFixed(1)));
    }

    const currentRating = ratings[selectedSport];
    if (!currentRating) {
      setErrors({ submit: 'No rating found for this sport' });
      return;
    }

    if (level === currentRating.level) {
      // No change, just go back
      router.back();
      return;
    }

    setSaving(true);
    setErrors({});

    try {
      // Update the rating in the database
      const { error: updateError } = await supabase
        .from('user_ratings')
        .update({
          level: level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRating.id);

      if (updateError) {
        console.error('Update error:', updateError);
        setErrors({ submit: 'Failed to save level: ' + updateError.message });
        setSaving(false);
        return;
      }

      // Log this as a manual adjustment in rating history
      if (userId) {
        await supabase.from('rating_history').insert({
          user_id: userId,
          match_id: null,
          sport: selectedSport,
          previous_level: currentRating.level,
          new_level: level,
          previous_reliability: currentRating.reliability,
          new_reliability: currentRating.reliability, // Unchanged
          metadata: { reason: 'manual_adjustment' },
        });
      }

      showAlert('Success', `${selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)} level updated to ${level.toFixed(1)}`);
      router.back();
    } catch (err: any) {
      console.error('Save error:', err);
      setErrors({ submit: err.message || 'Failed to save level' });
    } finally {
      setSaving(false);
    }
  };

  const currentRating = ratings[selectedSport];
  const hasChanges = currentRating && level !== currentRating.level;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit your level</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit your level</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Text style={styles.subtitle}>
            This sets your current starting point. Competitive matches adjust it over time.
          </Text>
        </View>

        {/* Sport Selector */}
        <View style={styles.sportSelector}>
          <Pressable
            style={[styles.sportTab, selectedSport === 'tennis' && styles.sportTabActive]}
            onPress={() => setSelectedSport('tennis')}
          >
            <Image
              source={require('@/assets/icons/tennis_icon.png')}
              style={[
                styles.sportIconSmall,
                selectedSport !== 'tennis' && styles.sportIconInactive,
              ]}
              contentFit="contain"
              transition={0}
            />
            <Text style={[
              styles.sportTabText,
              selectedSport === 'tennis' && styles.sportTabTextActive,
            ]}>
              Tennis
            </Text>
          </Pressable>

          <Pressable
            style={[styles.sportTab, selectedSport === 'padel' && styles.sportTabActive]}
            onPress={() => setSelectedSport('padel')}
          >
            <Image
              source={require('@/assets/icons/padel_icon.png')}
              style={[
                styles.sportIconSmall,
                selectedSport !== 'padel' && styles.sportIconInactive,
              ]}
              contentFit="contain"
              transition={0}
            />
            <Text style={[
              styles.sportTabText,
              selectedSport === 'padel' && styles.sportTabTextActive,
            ]}>
              Padel
            </Text>
          </Pressable>
        </View>

        {/* Preset Choices */}
        <View style={styles.levelsContainer}>
          <Pressable
            style={[
              styles.levelChoice,
              level === getLevelForChoice('beginner') && !manualMode && styles.levelChoiceSelected,
            ]}
            onPress={() => {
              setLevel(getLevelForChoice('beginner'));
              setManualMode(false);
              setManualInput(getLevelForChoice('beginner').toFixed(1));
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
              setLevel(getLevelForChoice('intermediate'));
              setManualMode(false);
              setManualInput(getLevelForChoice('intermediate').toFixed(1));
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
              setLevel(getLevelForChoice('advanced'));
              setManualMode(false);
              setManualInput(getLevelForChoice('advanced').toFixed(1));
            }}
          >
            <Text style={styles.levelChoiceTitle}>Competitive / Advanced</Text>
            <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('advanced').toFixed(1)}</Text>
          </Pressable>

          <Pressable
            style={styles.manualButton}
            onPress={() => {
              setManualMode(!manualMode);
              if (!manualMode) {
                setManualInput(level.toFixed(1));
              }
            }}
          >
            <Text style={styles.manualButtonText}>
              {manualMode ? '← Back to presets' : 'I already know my level →'}
            </Text>
          </Pressable>
        </View>

        {/* Manual Input */}
        {manualMode && (
          <View style={styles.manualInputContainer}>
            <Text style={styles.manualLabel}>Enter your level ({Config.rating.min}–{Config.rating.max})</Text>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={handleManualInput}
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
            {errors.manual && <Text style={styles.errorText}>{errors.manual}</Text>}
          </View>
        )}

        {/* Current Level Display */}
        <View style={styles.currentLevelContainer}>
          <View style={styles.sportIconContainer}>
            <Image
              source={selectedSport === 'tennis' 
                ? require('@/assets/icons/tennis_icon.png')
                : require('@/assets/icons/padel_icon.png')
              }
              style={styles.sportIconLarge}
              contentFit="contain"
              transition={200}
            />
          </View>
          <Text style={styles.suggestedLabel}>Your level:</Text>
          <Text style={styles.currentLevelText}>{level.toFixed(1)}</Text>
          {currentRating && (
            <>
              <Text style={styles.reliabilityNote}>
                Reliability: {(currentRating.reliability * 100).toFixed(0)}%
              </Text>
              <Text style={styles.reliabilitySubnote}>
                {currentRating.matchesPlayed} competitive matches played
              </Text>
            </>
          )}
        </View>

        {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title={saving ? 'Saving...' : 'Save'}
            onPress={handleSave}
            fullWidth
            disabled={saving || !hasChanges}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            fullWidth
            disabled={saving}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  infoCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
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
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});
