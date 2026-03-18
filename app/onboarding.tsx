import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Input } from '@/components';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Config, Sport } from '@/constants/config';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

type OnboardingStep = 'profile' | 'sports' | 'levels';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>('profile');
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedSports, setSelectedSports] = useState<Sport[]>([]);
  const [currentSportIndex, setCurrentSportIndex] = useState(0);
  const [levels, setLevels] = useState<Record<Sport, number>>({
    tennis: 2.5,
    padel: 2.5,
  });
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth/email');
      return;
    }
    setUserId(user.id);
  };

  const validateProfile = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    } else {
      // Check username uniqueness
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();
      
      if (existing) {
        newErrors.username = 'Username already taken';
      }
    }
    
    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinueProfile = async () => {
    const isValid = await validateProfile();
    if (isValid) {
      setStep('sports');
    }
  };

  const toggleSport = (sport: Sport) => {
    if (selectedSports.includes(sport)) {
      setSelectedSports(selectedSports.filter(s => s !== sport));
    } else {
      setSelectedSports([...selectedSports, sport]);
    }
  };

  const handleContinueSports = () => {
    if (selectedSports.length === 0) {
      setErrors({ sports: 'Select at least one sport' });
      return;
    }
    setErrors({});
    setCurrentSportIndex(0);
    setManualMode(false);
    setManualInput('');
    setStep('levels');
  };

  const getLevelForChoice = (choice: 'beginner' | 'intermediate' | 'advanced') => {
    return Config.onboardingLevels[choice];
  };

  const adjustLevel = (adjustment: 'lower' | 'same' | 'higher') => {
    const sport = selectedSports[currentSportIndex];
    let newLevel = manualMode && manualInput ? parseFloat(manualInput) : levels[sport];
    
    if (adjustment === 'lower') {
      newLevel -= Config.onboardingLevels.adjustment;
    } else if (adjustment === 'higher') {
      newLevel += Config.onboardingLevels.adjustment;
    }
    
    newLevel = Math.max(0, Math.min(7.0, newLevel));
    setLevels({ ...levels, [sport]: Number(newLevel.toFixed(1)) });
    
    if (manualMode) {
      setManualInput(newLevel.toFixed(1));
    }
  };

  const handleManualInput = (value: string) => {
    setManualInput(value);
    const parsed = parseFloat(value);
    
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(7.0, parsed));
      const sport = selectedSports[currentSportIndex];
      setLevels({ ...levels, [sport]: Number(clamped.toFixed(1)) });
    }
  };

  const handleUseManualLevel = () => {
    const parsed = parseFloat(manualInput);
    
    if (isNaN(parsed)) {
      setErrors({ manual: 'Please enter a valid number' });
      return;
    }
    
    const clamped = Math.max(0, Math.min(7.0, parsed));
    const sport = selectedSports[currentSportIndex];
    setLevels({ ...levels, [sport]: Number(clamped.toFixed(1)) });
    setManualMode(false);
    setErrors({});
  };

  const handleNextLevel = () => {
    if (currentSportIndex < selectedSports.length - 1) {
      setCurrentSportIndex(currentSportIndex + 1);
      setManualMode(false);
      setManualInput('');
    } else {
      handleCompleteOnboarding();
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!userId) return;

    setLoading(true);
    setErrors({});

    try {
      // Update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          username: username.toLowerCase(),
          display_name: displayName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Profile error:', profileError);
        setErrors({ submit: 'Failed to save profile: ' + profileError.message });
        setLoading(false);
        return;
      }

      // Create user ratings for selected sports
      const ratingInserts = selectedSports.map(sport => ({
        user_id: userId,
        sport,
        level: levels[sport],
        reliability: Config.rating.initialReliability,
        matches_played: 0,
      }));

      const { error: ratingsError } = await supabase
        .from('user_ratings')
        .insert(ratingInserts);

      if (ratingsError) {
        console.error('Ratings error:', ratingsError);
        setErrors({ submit: 'Failed to save ratings: ' + ratingsError.message });
        setLoading(false);
        return;
      }

      // Success - navigate to main app
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setErrors({ submit: err.message || 'Failed to complete onboarding' });
    } finally {
      setLoading(false);
    }
  };

  const renderProfile = () => (
    <View style={styles.stepContainer}>
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
          transition={200}
        />
      </View>
      <Text style={styles.title}>Create Your Profile</Text>
      <Text style={styles.subtitle}>Join the competitive racket sports community</Text>
      
      <View style={styles.form}>
        <Input
          label="Username"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            setErrors({ ...errors, username: undefined });
          }}
          placeholder="yourhandle"
          autoCapitalize="none"
          error={errors.username}
        />
        <Input
          label="Display Name"
          value={displayName}
          onChangeText={(text) => {
            setDisplayName(text);
            setErrors({ ...errors, displayName: undefined });
          }}
          placeholder="Your Name"
          error={errors.displayName}
        />
      </View>

      {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}

      <Button
        title="Continue"
        onPress={handleContinueProfile}
        fullWidth
        disabled={loading}
      />
    </View>
  );

  const renderSports = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Choose Your Sports</Text>
      <Text style={styles.subtitle}>Select the sports you play</Text>

      <View style={styles.sportsGrid}>
        {Config.sports.map(sport => (
          <Pressable
            key={sport}
            style={[
              styles.sportCard,
              selectedSports.includes(sport) && styles.sportCardSelected,
            ]}
            onPress={() => toggleSport(sport)}
          >
            <Text style={styles.sportIcon}>{sport === 'tennis' ? '🎾' : '🏸'}</Text>
            <Text style={styles.sportName}>
              {sport.charAt(0).toUpperCase() + sport.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {errors.sports && <Text style={styles.errorText}>{errors.sports}</Text>}

      <Button
        title="Continue"
        onPress={handleContinueSports}
        fullWidth
        disabled={loading}
      />
    </View>
  );

  const renderLevels = () => {
    const currentSport = selectedSports[currentSportIndex];
    const currentLevel = levels[currentSport];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.title}>
          How good are you at {currentSport}?
        </Text>
        <Text style={styles.subtitle}>
          {currentSportIndex + 1} of {selectedSports.length}
        </Text>

        <View style={styles.levelsContainer}>
          <Pressable
            style={styles.levelChoice}
            onPress={() => {
              setLevels({ ...levels, [currentSport]: getLevelForChoice('beginner') });
              setManualMode(false);
            }}
          >
            <Text style={styles.levelChoiceTitle}>New / Beginner</Text>
            <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('beginner')}</Text>
          </Pressable>

          <Pressable
            style={styles.levelChoice}
            onPress={() => {
              setLevels({ ...levels, [currentSport]: getLevelForChoice('intermediate') });
              setManualMode(false);
            }}
          >
            <Text style={styles.levelChoiceTitle}>Casual / Intermediate</Text>
            <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('intermediate')}</Text>
          </Pressable>

          <Pressable
            style={styles.levelChoice}
            onPress={() => {
              setLevels({ ...levels, [currentSport]: getLevelForChoice('advanced') });
              setManualMode(false);
            }}
          >
            <Text style={styles.levelChoiceTitle}>Competitive / Advanced</Text>
            <Text style={styles.levelChoiceLevel}>Level {getLevelForChoice('advanced')}</Text>
          </Pressable>

          <Pressable
            style={styles.manualButton}
            onPress={() => {
              setManualMode(!manualMode);
              if (!manualMode) {
                setManualInput(currentLevel.toFixed(1));
              }
            }}
          >
            <Text style={styles.manualButtonText}>
              {manualMode ? '← Back to presets' : 'I already know my rank →'}
            </Text>
          </Pressable>
        </View>

        {manualMode && (
          <View style={styles.manualInputContainer}>
            <Text style={styles.manualLabel}>Enter your level (0.0–7.0)</Text>
            <TextInput
              style={styles.manualInput}
              value={manualInput}
              onChangeText={handleManualInput}
              placeholder="2.5"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="decimal-pad"
              maxLength={3}
            />
            {parseFloat(manualInput) > 4.5 && !isNaN(parseFloat(manualInput)) && (
              <Text style={styles.warningText}>
                ⚠️ Most players start between 0–4, but you can set any level.
              </Text>
            )}
            {errors.manual && <Text style={styles.errorText}>{errors.manual}</Text>}
          </View>
        )}

        <View style={styles.currentLevelContainer}>
          <Text style={styles.suggestedLabel}>Your starting level:</Text>
          <Text style={styles.currentLevelText}>{currentLevel.toFixed(1)}</Text>
          <Text style={styles.reliabilityNote}>
            Reliability: {(Config.rating.initialReliability * 100).toFixed(0)}%
          </Text>
          <Text style={styles.reliabilitySubnote}>
            Only competitive confirmed matches change your level
          </Text>
        </View>

        <View style={styles.adjustmentContainer}>
          <Text style={styles.adjustLabel}>Adjust:</Text>
          <View style={styles.adjustButtons}>
            <Pressable style={styles.adjustButton} onPress={() => adjustLevel('lower')}>
              <Text style={styles.adjustButtonText}>Lower</Text>
            </Pressable>
            <Pressable style={styles.adjustButton} onPress={() => adjustLevel('same')}>
              <Text style={styles.adjustButtonText}>About right</Text>
            </Pressable>
            <Pressable style={styles.adjustButton} onPress={() => adjustLevel('higher')}>
              <Text style={styles.adjustButtonText}>Higher</Text>
            </Pressable>
          </View>
        </View>

        {errors.submit && <Text style={styles.errorText}>{errors.submit}</Text>}

        <Button
          title={currentSportIndex < selectedSports.length - 1 ? 'Next Sport' : 'Complete'}
          onPress={handleNextLevel}
          fullWidth
          disabled={loading}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {step === 'profile' && renderProfile()}
        {step === 'sports' && renderSports()}
        {step === 'levels' && renderLevels()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  stepContainer: {
    gap: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  sportsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  sportCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sportCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  sportIcon: {
    fontSize: 48,
  },
  sportName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
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
  adjustmentContainer: {
    gap: Spacing.sm,
  },
  adjustLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  adjustButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});
