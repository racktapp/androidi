import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button } from '@/components';
import { Sport, Config } from '@/constants/config';
import { getSupabaseClient } from '@/template';
import LevelSelectionPanel from '@/components/level/LevelSelectionPanel';

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

        <LevelSelectionPanel
          sport={selectedSport}
          level={level}
          manualMode={manualMode}
          manualInput={manualInput}
          onLevelChange={setLevel}
          onManualModeChange={setManualMode}
          onManualInputChange={handleManualInput}
          manualError={errors.manual}
          reliabilityText={currentRating ? `Reliability: ${(currentRating.reliability * 100).toFixed(0)}%` : 'Reliability: --'}
          reliabilitySubtext={currentRating ? `${currentRating.matchesPlayed} competitive matches played` : 'No competitive matches played yet'}
          showSportSelector
          onSportChange={setSelectedSport}
        />

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
