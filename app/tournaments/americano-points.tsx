import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, UserName, LoadingSpinner } from '@/components';
import { tournamentsService } from '@/services/tournaments';
import { TournamentMatch } from '@/types';
import { useAlert } from '@/template';

export default function AmericanoPointsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { matchId } = useLocalSearchParams();
  const { showAlert } = useAlert();

  const [match, setMatch] = useState<TournamentMatch | null>(null);
  const [pointsA, setPointsA] = useState('0');
  const [pointsB, setPointsB] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMatch();
  }, [matchId]);

  const loadMatch = async () => {
    if (!matchId || typeof matchId !== 'string') return;

    try {
      const matches = await tournamentsService.getMatchesByTournament('');
      const foundMatch = matches.find(m => m.id === matchId);
      
      if (foundMatch) {
        setMatch(foundMatch);
        if (foundMatch.score.length > 0) {
          setPointsA(String(foundMatch.score[0].a));
          setPointsB(String(foundMatch.score[0].b));
        }
      }
    } catch (err: any) {
      console.error('Error loading match:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const ptsA = parseInt(pointsA) || 0;
    const ptsB = parseInt(pointsB) || 0;

    if (ptsA === 0 && ptsB === 0) {
      showAlert('Invalid Points', 'Please enter valid points for both teams');
      return;
    }

    if (!match) return;

    setSubmitting(true);
    try {
      await tournamentsService.submitAmericanoMatchPoints(match.id, ptsA, ptsB);
      showAlert('Success', 'Points submitted successfully');
      router.back();
    } catch (err: any) {
      console.error('Error submitting points:', err);
      showAlert('Error', err.message || 'Failed to submit points');
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
          <Text style={styles.headerTitle}>Enter Points</Text>
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
        <Text style={styles.headerTitle}>Enter Points</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Match Info */}
        <View style={styles.matchCard}>
          <View style={styles.roundLabel}>
            <Text style={styles.roundLabelText}>Round {match.roundIndex + 1}</Text>
          </View>

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

        {/* Points Input */}
        <View style={styles.pointsSection}>
          <Text style={styles.sectionTitle}>Match Points</Text>
          
          <View style={styles.pointsCard}>
            <View style={styles.pointsInputRow}>
              <View style={styles.pointsInput}>
                <Text style={styles.pointsInputLabel}>Team A</Text>
                <TextInput
                  style={styles.pointsInputField}
                  value={pointsA}
                  onChangeText={setPointsA}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <Text style={styles.pointsDivider}>:</Text>

              <View style={styles.pointsInput}>
                <Text style={styles.pointsInputLabel}>Team B</Text>
                <TextInput
                  style={styles.pointsInputField}
                  value={pointsB}
                  onChangeText={setPointsB}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <MaterialIcons name="info-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              Enter the final points for each team. Americano matches are typically played to 21 points.
            </Text>
          </View>
        </View>

        <Button
          title={submitting ? 'Submitting...' : 'Submit Points'}
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
  roundLabel: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  roundLabelText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
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
  pointsSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  pointsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  pointsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pointsInput: {
    flex: 1,
    gap: Spacing.xs,
  },
  pointsInputLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  pointsInputField: {
    fontSize: 48,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  pointsDivider: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
});
