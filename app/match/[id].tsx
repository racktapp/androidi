import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, MatchPoster, LoadingSpinner, UserName } from '@/components';
import type { PosterData } from '@/components';
import { useMatches } from '@/hooks/useMatches';
import { Match } from '@/types';
import { getSupabaseClient } from '@/template';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { normalizeMatchSets, calculateSetsWon, determineWinner } from '@/services/matchUtils';
import { getUserLabel } from '@/utils/getUserLabel';

const supabase = getSupabaseClient();

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert } = useAlert();
  const { getMatchById, confirmMatch } = useMatches();
  const posterRef = React.useRef<View>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [sharing, setSharing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (id) {
      loadMatch();
    }
  }, [id]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadMatch = async () => {
    if (!id) return;
    const data = await getMatchById(id);
    setMatch(data);
  };

  const handleConfirm = async () => {
    if (!id || !userId) return;

    setConfirming(true);
    try {
      await confirmMatch(id, userId);
      showAlert('Success', 'Match confirmed!');
      await loadMatch();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not confirm match. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const getPosterData = (): PosterData | null => {
    if (!match) return null;

    const teamAPlayers = match.players?.filter(p => p.team === 'A') || [];
    const teamBPlayers = match.players?.filter(p => p.team === 'B') || [];

    // Build team names and handles using getUserLabel
    const getTeamInfo = (players: typeof teamAPlayers) => {
      if (players.length === 0) {
        return { name: 'Player', handle: '' };
      }
      
      const labels = players.map(p => getUserLabel(p.user));
      
      // For display names, use first name only to save space
      const names = labels
        .map(l => l.displayName.split(' ')[0])
        .join(' / ');
      
      // For handles, show full @username
      const handles = labels
        .map(l => l.handle)
        .filter(Boolean)
        .join(' / ');

      return { name: names, handle: handles };
    };

    const teamAInfo = getTeamInfo(teamAPlayers);
    const teamBInfo = getTeamInfo(teamBPlayers);

    // Get avatar info for first player in each team
    const teamAFirstPlayer = teamAPlayers[0]?.user;
    const teamBFirstPlayer = teamBPlayers[0]?.user;

    // Build sets array using normalizer (handles snake_case DB fields)
    const sets = normalizeMatchSets(match);

    // Calculate sets won
    const { setsWonA: finalSetsWonA, setsWonB: finalSetsWonB } = calculateSetsWon(sets);

    // Determine winner
    const winnerSide: 'A' | 'B' = determineWinner(sets) || 'A';

    return {
      sport: match.sport,
      format: match.format,
      matchType: match.type,
      groupName: match.group?.name || 'Match',
      teamAName: teamAInfo.name,
      teamBName: teamBInfo.name,
      teamAHandle: teamAInfo.handle,
      teamBHandle: teamBInfo.handle,
      teamAAvatar: teamAFirstPlayer?.avatarUrl,
      teamBAvatar: teamBFirstPlayer?.avatarUrl,
      sets,
      winnerSide,
      finalSetsWonA,
      finalSetsWonB,
      createdByName: match.players?.find(p => (p.userId || p.user_id) === match.createdBy)?.user?.displayName,
    };
  };

  const handleShare = async () => {
    const posterData = getPosterData();
    if (!posterData) {
      showAlert('Error', 'Match data not ready');
      return;
    }

    setSharing(true);

    try {
      if (!posterRef.current) {
        throw new Error('Poster not rendered');
      }

      // Capture poster as image
      const uri = await captureRef(posterRef.current, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1920,
      });

      // Copy to cache directory with a proper filename
      const filename = `rackt-match-${id}.png`;
      const newUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.copyAsync({
        from: uri,
        to: newUri,
      });

      // Share the image
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error('Sharing is not available on this device');
      }

      await Sharing.shareAsync(newUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Match Result',
      });

    } catch (err: any) {
      console.error('Share error:', err);
      showAlert('Error', err.message || 'Could not generate poster, try again');
    } finally {
      setSharing(false);
    }
  };

  if (!match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={48} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const posterData = getPosterData();
  const teamAPlayers = match.players?.filter(p => p.team === 'A') || [];
  const teamBPlayers = match.players?.filter(p => p.team === 'B') || [];
  
  // Helper function to safely get user's team side
  const getUserSide = (players: any[] | undefined, targetUserId: string | null): 'A' | 'B' | null => {
    if (!players || !targetUserId) return null;
    
    // Try to find by userId (camelCase) or user_id (snake_case)
    const player = players.find(p => {
      // Handle both camelCase and snake_case field names
      const playerId = p.userId || p.user_id || (p.user && (p.user.id || p.user.user_id));
      return playerId === targetUserId;
    });
    
    if (!player) {
      return null;
    }
    
    const side = player.team || player.side;
    if (side !== 'A' && side !== 'B') {
      console.error('[Match Details] Invalid team side:', side);
      return null;
    }
    
    return side;
  };
  
  // Confirmation eligibility logic
  const isPending = match.status === 'pending';
  const isConfirmed = match.status === 'confirmed';
  const isCreator = userId === match.createdBy;
  
  // Get user's side and creator's side using helper
  const mySide = getUserSide(match.players, userId);
  const creatorSide = getUserSide(match.players, match.createdBy);

  // Check if team data is incomplete
  const hasIncompleteSides = (mySide === null || creatorSide === null) && !isConfirmed;
  
  // User is opponent if they're on different teams
  const amOpponent = mySide !== null && creatorSide !== null && mySide !== creatorSide;
  
  // Can confirm if: pending + opponent + not creator
  const canConfirm = isPending && amOpponent && !isCreator;

  const getRatingChange = (playerId: string) => {
    const player = match.players?.find(p => (p.userId || p.user_id) === playerId);
    if (!player || player.levelAfter === undefined || player.levelBefore === undefined) return null;

    const change = player.levelAfter - player.levelBefore;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
            transition={200}
          />
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Pressable onPress={handleShare} disabled={sharing}>
            <MaterialIcons 
              name="share" 
              size={24} 
              color={sharing ? Colors.textMuted : Colors.textPrimary} 
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: canConfirm ? insets.bottom + 100 : insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Poster Preview */}
        {posterData && (
          <View style={styles.posterPreviewContainer}>
            <MatchPoster data={posterData} size="preview" />
          </View>
        )}

        {/* Hidden full-size poster for capture */}
        <View style={styles.hiddenPoster}>
          {posterData && <MatchPoster ref={posterRef} data={posterData} size="full" />}
        </View>

        {/* Status Indicator */}
        {isConfirmed && (
          <View style={styles.confirmedBadge}>
            <MaterialIcons name="check-circle" size={24} color={Colors.success} />
            <Text style={styles.confirmedText}>Match Confirmed ✓</Text>
          </View>
        )}
        
        {hasIncompleteSides && !isConfirmed && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={24} color={Colors.danger} />
            <Text style={styles.errorText}>
              Match data incomplete (missing teams). Please contact support.
            </Text>
          </View>
        )}

        {/* Share Button */}
        <Button
          title={sharing ? 'Generating poster...' : 'Share Poster'}
          variant="outline"
          onPress={handleShare}
          disabled={sharing}
          fullWidth
          icon={sharing ? <LoadingSpinner size={20} /> : undefined}
        />

        {/* Match Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type</Text>
            <View style={styles.typeInfoContainer}>
              <View style={[
                styles.typeBadge,
                match.type === 'competitive' ? styles.typeCompetitive : styles.typeFriendly,
              ]}>
                <Text style={styles.typeBadgeText}>
                  {match.type.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.typeHelper}>
                {match.type === 'competitive' ? 'Affects level' : 'Does not affect level'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[
              styles.statusBadge,
              match.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending,
            ]}>
              <Text style={styles.statusBadgeText}>
                {match.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {match.status === 'confirmed' && match.confirmedAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Confirmed</Text>
              <Text style={styles.infoValue}>
                {new Date(match.confirmedAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Sets Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sets</Text>
          {posterData && posterData.sets.length > 0 ? (
            <View style={styles.setsList}>
              {posterData.sets.map((set, index) => (
                <View key={index} style={styles.setCard}>
                  <Text style={styles.setLabel}>Set {index + 1}</Text>
                  <View style={styles.setScoreRow}>
                    <Text style={styles.setScore}>
                      {set.a} - {set.b}
                    </Text>
                    {set.tiebreak && (
                      <Text style={styles.tiebreak}>({set.tiebreak})</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noScoreText}>Score not recorded</Text>
          )}
        </View>

        {/* Rating Changes */}
        {match.status === 'confirmed' && match.type === 'competitive' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rating Changes</Text>
            <View style={styles.ratingsList}>
              {[...teamAPlayers, ...teamBPlayers].map(player => {
                const playerId = player.userId || player.user_id;
                const change = getRatingChange(playerId);
                if (!change) return null;

                return (
                  <View key={player.id} style={styles.ratingRow}>
                    <UserName
                      profile={player.user}
                      displayNameStyle={styles.ratingPlayerName}
                      numberOfLines={1}
                    />
                    <View style={styles.ratingStats}>
                      <Text style={[
                        styles.levelChange,
                        player.levelAfter! > player.levelBefore! ? styles.levelUp : styles.levelDown,
                      ]}>
                        {change}
                      </Text>
                      <Text style={styles.newLevel}>
                        → {player.levelAfter?.toFixed(1)}
                      </Text>
                      <Text style={styles.reliability}>
                        {((player.reliabilityAfter || 0) * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Confirm Button */}
      {canConfirm && (
        <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            title={confirming ? 'Confirming...' : 'Confirm Match'}
            onPress={handleConfirm}
            disabled={confirming}
            fullWidth
            icon={confirming ? <LoadingSpinner size={20} /> : undefined}
          />
        </View>
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  posterPreviewContainer: {
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  hiddenPoster: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    opacity: 0,
  },

  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  confirmedText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.success,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  infoValue: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  typeInfoContainer: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  typeHelper: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  typeCompetitive: {
    backgroundColor: Colors.primary,
  },
  typeFriendly: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusConfirmed: {
    backgroundColor: Colors.success,
  },
  statusPending: {
    backgroundColor: Colors.warning,
  },
  statusBadgeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.bold,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  setsList: {
    gap: Spacing.sm,
  },
  setCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  setScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  setScore: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  tiebreak: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  ratingsList: {
    gap: Spacing.sm,
  },
  ratingRow: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingPlayerName: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    flex: 1,
  },
  ratingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  levelChange: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
  },
  levelUp: {
    color: Colors.success,
  },
  levelDown: {
    color: Colors.danger,
  },
  newLevel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  reliability: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  noScoreText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.danger,
    fontWeight: Typography.weights.medium,
  },
});
