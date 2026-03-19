import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, LoadingSpinner } from '@/components';
import { tournamentsService } from '@/services/tournaments';
import { TournamentMatch } from '@/types';
import { useAlert } from '@/template';

export default function MatchScoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { matchId } = useLocalSearchParams();
  const { showAlert } = useAlert();

  const [match, setMatch] = useState<TournamentMatch | null>(null);
  const [sets, setSets] = useState<{ a: number; b: number }[]>([{ a: 0, b: 0 }]);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadMatch = useCallback(async () => {
    if (!matchId || typeof matchId !== 'string') return;

    try {
      const matches = await tournamentsService.getMatchesByTournament('');
      const foundMatch = matches.find(m => m.id === matchId);
      
      if (foundMatch) {
        setMatch(foundMatch);
        if (foundMatch.score.length > 0) {
          setSets(foundMatch.score);
        }
      }
    } catch (err: any) {
      console.error('Error loading match:', err);
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void loadMatch();
  }, [loadMatch]);

  const updateScore = (setIndex: number, team: 'a' | 'b', value: number) => {
    const newSets = [...sets];
    newSets[setIndex] = { ...newSets[setIndex], [team]: Math.max(0, value) };
    setSets(newSets);
  };

  const addSet = () => {
    setSets([...sets, { a: 0, b: 0 }]);
  };

  const removeSet = (index: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== index));
    }
  };

  const calculateWinner = (): 'A' | 'B' | null => {
    let setsA = 0;
    let setsB = 0;

    for (const set of sets) {
      if (set.a > set.b) setsA++;
      else if (set.b > set.a) setsB++;
    }

    if (setsA > setsB) return 'A';
    if (setsB > setsA) return 'B';
    return null;
  };

  const handleSubmit = async () => {
    const winner = calculateWinner();
    
    if (!winner) {
      showAlert('Invalid Score', 'Please ensure one team has won more sets');
      return;
    }

    if (!match) return;

    setSubmitting(true);
    try {
      await tournamentsService.submitMatchScore(match.id, sets, winner);
      showAlert('Success', 'Score submitted successfully');
      router.back();
    } catch (err: any) {
      console.error('Error submitting score:', err);
      showAlert('Error', err.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Enter Score</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContent}>
          <LoadingSpinner size={32} />
        </View>
      </View>
    );
  }

  const teamANames = match.teamA.members?.map(m => m.displayName).join(' / ') || 'Team A';
  const teamBNames = match.teamB.members?.map(m => m.displayName).join(' / ') || 'Team B';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Enter Score</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Match Info */}
        <View style={styles.matchCard}>
          <View style={styles.teamRow}>
            <Text style={styles.teamLabel}>Team A</Text>
            <Text style={styles.teamName} numberOfLines={1}>{teamANames}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.teamRow}>
            <Text style={styles.teamLabel}>Team B</Text>
            <Text style={styles.teamName} numberOfLines={1}>{teamBNames}</Text>
          </View>
        </View>

        {/* Sets */}
        <View style={styles.setsSection}>
          <Text style={styles.sectionTitle}>Sets</Text>
          {sets.map((set, index) => (
            <View key={index} style={styles.setCard}>
              <Text style={styles.setLabel}>Set {index + 1}</Text>
              
              <View style={styles.scoreRow}>
                <View style={styles.scoreInput}>
                  <Pressable
                    style={styles.scoreButton}
                    onPress={() => updateScore(index, 'a', set.a - 1)}
                  >
                    <MaterialIcons name="remove" size={20} color={Colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.scoreValue}>{set.a}</Text>
                  <Pressable
                    style={styles.scoreButton}
                    onPress={() => updateScore(index, 'a', set.a + 1)}
                  >
                    <MaterialIcons name="add" size={20} color={Colors.textPrimary} />
                  </Pressable>
                </View>

                <Text style={styles.scoreDivider}>–</Text>

                <View style={styles.scoreInput}>
                  <Pressable
                    style={styles.scoreButton}
                    onPress={() => updateScore(index, 'b', set.b - 1)}
                  >
                    <MaterialIcons name="remove" size={20} color={Colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.scoreValue}>{set.b}</Text>
                  <Pressable
                    style={styles.scoreButton}
                    onPress={() => updateScore(index, 'b', set.b + 1)}
                  >
                    <MaterialIcons name="add" size={20} color={Colors.textPrimary} />
                  </Pressable>
                </View>

                {sets.length > 1 && (
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removeSet(index)}
                  >
                    <MaterialIcons name="delete" size={20} color={Colors.danger} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {sets.length < 5 && (
            <Pressable style={styles.addSetButton} onPress={addSet}>
              <MaterialIcons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addSetText}>Add Set</Text>
            </Pressable>
          )}
        </View>

        <Button
          title={submitting ? 'Submitting...' : 'Submit Score'}
          onPress={handleSubmit}
          fullWidth
          disabled={submitting}
          icon={submitting ? <LoadingSpinner size={20} /> : undefined}
        />
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
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  teamRow: {
    width: '100%',
    gap: Spacing.xs,
  },
  teamLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.semibold,
  },
  teamName: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  vsText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    paddingVertical: Spacing.xs,
  },
  setsSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  setCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  setLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  scoreButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    flex: 1,
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  scoreDivider: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  addSetText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
});
