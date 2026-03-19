import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, UserAvatar, UserName, ScreenLoader, LoadingSpinner } from '@/components';
import { tournamentsService } from '@/services/tournaments';
import { Tournament, TournamentGroup, TournamentMatch, TournamentStanding, AmericanoLeaderboardEntry, AmericanoPairLeaderboardEntry } from '@/types';
import { getSupabaseClient , useAlert } from '@/template';

const supabase = getSupabaseClient();

type TabType = 'overview' | 'groups' | 'playoffs' | 'matches' | 'rounds' | 'leaderboard' | 'players';
type LeaderboardViewType = 'players' | 'pairs';

export default function TournamentDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { showAlert } = useAlert();

  const [userId, setUserId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupStandings, setGroupStandings] = useState<TournamentStanding[]>([]);
  const [groupMatches, setGroupMatches] = useState<TournamentMatch[]>([]);
  const [playoffMatches, setPlayoffMatches] = useState<TournamentMatch[]>([]);
  const [allMatches, setAllMatches] = useState<TournamentMatch[]>([]);
  const [americanoLeaderboard, setAmericanoLeaderboard] = useState<AmericanoLeaderboardEntry[]>([]);
  const [americanoPairLeaderboard, setAmericanoPairLeaderboard] = useState<AmericanoPairLeaderboardEntry[]>([]);
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardViewType>('players');
  const [completingTournament, setCompletingTournament] = useState(false);
  const [ratingDeltas, setRatingDeltas] = useState<{ userId: string; displayName: string; delta: number }[] | null>(null);
  const [deletingTournament, setDeletingTournament] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFoundState, setNotFoundState] = useState<'loading' | 'not_found' | 'access_pending' | 'success'>('loading');

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadTournament = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    try {
      setError(null);
      setNotFoundState('loading');

      const data = await tournamentsService.getTournamentById(id as string, userId || undefined);
      
      if (!data) {
        // Tournament not found or not accessible
        setNotFoundState('access_pending');
        setTournament(null);
        setError('Tournament not found or not accessible yet');
      } else {
        setNotFoundState('success');
        setTournament(data);
        setError(null);
      }
    } catch (err: any) {
      console.error('[TournamentDetail] Error loading tournament:', {
        message: err.message,
        code: err.code,
        tournamentId: id,
        userId,
      });
      setNotFoundState('not_found');
      setError(err.message || 'Failed to load tournament');
    } finally {
      setIsLoading(false);
    }
  }, [id, userId]);

  const loadTournamentData = useCallback(async () => {
    if (!tournament || !id || typeof id !== 'string') return;

    try {
      if (tournament.type === 'americano') {
        const [matchesData, leaderboardData, pairLeaderboardData] = await Promise.all([
          tournamentsService.getMatchesByTournament(id),
          tournamentsService.getAmericanoLeaderboard(id),
          tournament.mode === 'doubles' 
            ? tournamentsService.getAmericanoPairLeaderboard(id)
            : Promise.resolve([]),
        ]);
        setAllMatches(matchesData);
        setAmericanoLeaderboard(leaderboardData);
        setAmericanoPairLeaderboard(pairLeaderboardData);
      } else {
        const [groupsData, matchesData] = await Promise.all([
          tournamentsService.getGroupsByTournament(id),
          tournamentsService.getMatchesByTournament(id),
        ]);
        setGroups(groupsData);
        setAllMatches(matchesData);
        setPlayoffMatches(matchesData.filter(m => m.stage === 'playoff'));
        if (groupsData.length > 0 && !selectedGroupId) {
          setSelectedGroupId(groupsData[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading tournament data:', err);
    }
  }, [id, selectedGroupId, tournament]);

  const loadGroupData = useCallback(async () => {
    if (!selectedGroupId) return;

    try {
      const [standings, matches] = await Promise.all([
        tournamentsService.getGroupStandings(selectedGroupId),
        tournamentsService.getMatchesByGroup(selectedGroupId),
      ]);

      setGroupStandings(standings);
      setGroupMatches(matches);
    } catch (err: any) {
      console.error('Error loading group data:', err);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (userId && id) {
      void loadTournament();
    }
  }, [id, loadTournament, userId]);

  useEffect(() => {
    if (tournament && tournament.state === 'in_progress') {
      void loadTournamentData();
    }
  }, [activeTab, loadTournamentData, tournament]);

  useEffect(() => {
    if (selectedGroupId) {
      void loadGroupData();
    }
  }, [loadGroupData, selectedGroupId]);

  const handleStartTournament = async () => {
    if (!tournament) return;

    try {
      if (tournament.type === 'americano') {
        await tournamentsService.generateAmericanoTournament(tournament.id);
      } else {
        await tournamentsService.generateNormalTournament(tournament.id);
      }
      await loadTournament();
      await loadTournamentData();
      setActiveTab(tournament.type === 'americano' ? 'rounds' : 'groups');
    } catch (err: any) {
      console.error('Error starting tournament:', err);
      showAlert('Error', err.message || 'Failed to start tournament');
    }
  };

  const handleConfirmMatch = async (matchId: string) => {
    try {
      await tournamentsService.confirmMatch(matchId, false);
      await loadTournamentData();
      if (selectedGroupId) {
        await loadGroupData();
      }
    } catch (err: any) {
      console.error('Error confirming match:', err);
      showAlert('Error', err.message || 'Failed to confirm match');
    }
  };

  const handleStateChange = async (newState: Tournament['state']) => {
    if (!tournament) return;

    if (newState === 'locked') {
      const validation = tournamentsService.validateTournamentForLocking(tournament);
      if (!validation.valid) {
        showAlert('Cannot Lock Tournament', validation.message);
        return;
      }
    }

    try {
      await tournamentsService.updateTournamentState(tournament.id, newState);
      setTournament({ ...tournament, state: newState });
    } catch (err: any) {
      console.error('Error updating tournament:', err);
      setError(err.message || 'Failed to update tournament');
    }
  };

  const handleCompleteTournament = async () => {
    if (!tournament) return;

    setCompletingTournament(true);
    try {
      const result = await tournamentsService.completeAmericanoTournament(tournament.id);
      await loadTournament();
      
      if (result.ratingDeltas && result.ratingDeltas.length > 0) {
        setRatingDeltas(result.ratingDeltas);
      } else {
        showAlert('Success', 'Tournament completed successfully');
      }
    } catch (err: any) {
      console.error('Error completing tournament:', err);
      showAlert('Error', err.message || 'Failed to complete tournament');
    } finally {
      setCompletingTournament(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    
    setShowDeleteConfirm(false);
    setDeletingTournament(true);
    
    try {
      await tournamentsService.deleteTournament(tournament.id);
      
      showAlert('Tournament Deleted', 'This tournament has been permanently deleted.');
      
      // Navigate back after short delay
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err: any) {
      // INSTRUMENTATION: Log full error details
      console.error('[TournamentDelete] ERROR:', {
        message: err.message,
        stack: err.stack,
        tournamentId: tournament.id,
        userId,
      });
      
      // Show specific error message
      const errorMessage = err.message || 'Failed to delete tournament';
      showAlert('Error', errorMessage);
      setDeletingTournament(false);
    }
  };

  const renderOverviewTab = () => {
    if (!tournament) return null;

    const isCreator = userId === tournament.createdByUserId;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Image
              source={tournament.sport === 'tennis' 
                ? require('@/assets/icons/tennis_icon.png')
                : require('@/assets/icons/padel_icon.png')
              }
              style={styles.sportIconLarge}
              contentFit="contain"
              transition={0}
            />
            <View style={styles.infoHeaderText}>
              <Text style={styles.tournamentTitle}>{tournament.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {tournament.type === 'americano' ? 'Americano' : 'Normal'}
                </Text>
                <Text style={styles.metaDivider}>•</Text>
                <Text style={styles.metaText}>
                  {tournament.mode === 'singles' ? 'Singles' : 'Doubles'}
                </Text>
                {tournament.isCompetitive && (
                  <>
                    <Text style={styles.metaDivider}>•</Text>
                    <MaterialIcons name="star" size={14} color={Colors.accentGold} />
                    <Text style={[styles.metaText, { color: Colors.accentGold }]}>
                      Competitive
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          <View style={styles.stateChip}>
            <Text style={styles.stateChipText}>
              {tournament.state.charAt(0).toUpperCase() + tournament.state.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.participantsCard}>
          <Text style={styles.cardTitle}>
            Participants ({tournament.participants.length})
          </Text>
          <View style={styles.participantsList}>
            {tournament.participants.map((participant) => (
              <View key={participant.userId} style={styles.participantRow}>
                <UserAvatar
                  name={participant.displayName}
                  avatarUrl={participant.avatarUrl}
                  size={40}
                />
                <UserName
                  profile={{
                    id: participant.userId,
                    displayName: participant.displayName,
                    username: participant.username,
                  }}
                  displayNameStyle={styles.participantName}
                />
                {participant.userId === tournament.createdByUserId && (
                  <View style={styles.creatorBadge}>
                    <Text style={styles.creatorBadgeText}>Creator</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {tournament.state === 'draft' && isCreator && (
          <View style={styles.actionsCard}>
            <Text style={styles.helperText}>
              Your tournament is in draft mode. Invite players to get started.
            </Text>
            <Button
              title="Invite Players"
              onPress={() => router.push(`/tournaments/invite?id=${tournament.id}`)}
              fullWidth
              variant="secondary"
              icon={<MaterialIcons name="person-add" size={20} color={Colors.textPrimary} />}
            />
            <Button
              title="Start Inviting"
              onPress={() => handleStateChange('inviting')}
              fullWidth
            />
          </View>
        )}

        {tournament.state === 'inviting' && isCreator && (
          <View style={styles.actionsCard}>
            <Text style={styles.helperText}>
              Waiting for players to accept invites. Once ready, lock the tournament.
            </Text>
            <Button
              title="Invite More Players"
              onPress={() => router.push(`/tournaments/invite?id=${tournament.id}`)}
              fullWidth
              variant="secondary"
              icon={<MaterialIcons name="person-add" size={20} color={Colors.textPrimary} />}
            />
            <Button
              title="Lock Tournament"
              onPress={() => handleStateChange('locked')}
              fullWidth
            />
          </View>
        )}

        {tournament.state === 'locked' && (
          <View style={styles.actionsCard}>
            {isCreator && (
              <>
                <Text style={styles.helperText}>
                  Tournament is locked. Ready to generate {tournament.type === 'americano' ? 'rounds' : 'groups and matches'}?
                </Text>
                <Button
                  title="Start Tournament"
                  onPress={handleStartTournament}
                  fullWidth
                />
              </>
            )}
            {!isCreator && (
              <View style={styles.lockedInfo}>
                <MaterialIcons name="lock" size={20} color={Colors.textMuted} />
                <Text style={styles.lockedText}>
                  Tournament is locked. Waiting for creator to start.
                </Text>
              </View>
            )}
          </View>
        )}

        {tournament.state === 'completed' && (
          <View style={styles.placeholderCard}>
            <MaterialIcons name="emoji-events" size={48} color={Colors.accentGold} />
            <Text style={styles.placeholderTitle}>Tournament Completed!</Text>
            <Text style={styles.placeholderText}>
              {tournament.type === 'americano' 
                ? 'Check the Leaderboard tab for final results'
                : 'Check the Groups and Playoffs tabs for final results'}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderRoundsTab = () => {
    if (allMatches.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Rounds will appear after tournament starts</Text>
        </View>
      );
    }

    // Group matches by round
    const rounds = new Map<number, TournamentMatch[]>();
    for (const match of allMatches) {
      if (!rounds.has(match.roundIndex)) {
        rounds.set(match.roundIndex, []);
      }
      rounds.get(match.roundIndex)!.push(match);
    }

    const sortedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {sortedRounds.map(([roundNum, matches]) => (
          <View key={roundNum} style={styles.roundSection}>
            <Text style={styles.roundTitle}>Round {roundNum + 1}</Text>
            <View style={styles.matchesCard}>
              {matches.map(match => renderMatchCard(match))}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderLeaderboardTab = () => {
    if (americanoLeaderboard.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Leaderboard will appear after matches are played</Text>
        </View>
      );
    }

    const showPairToggle = tournament?.mode === 'doubles' && americanoPairLeaderboard.length > 0;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* View Toggle */}
        {showPairToggle && (
          <View style={styles.viewToggle}>
            <Pressable
              style={[
                styles.viewToggleButton,
                leaderboardView === 'players' && styles.viewToggleButtonActive,
              ]}
              onPress={() => setLeaderboardView('players')}
            >
              <Text style={[
                styles.viewToggleText,
                leaderboardView === 'players' && styles.viewToggleTextActive,
              ]}>
                Players
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.viewToggleButton,
                leaderboardView === 'pairs' && styles.viewToggleButtonActive,
              ]}
              onPress={() => setLeaderboardView('pairs')}
            >
              <Text style={[
                styles.viewToggleText,
                leaderboardView === 'pairs' && styles.viewToggleTextActive,
              ]}>
                Pairs
              </Text>
            </Pressable>
          </View>
        )}

        {/* Player View */}
        {leaderboardView === 'players' && (
          <View style={styles.standingsCard}>
            <Text style={styles.cardTitle}>Individual Leaderboard</Text>
            <View style={styles.standingsTable}>
              <View style={styles.standingsHeader}>
                <Text style={[styles.standingsHeaderText, { flex: 2 }]}>Player</Text>
                <Text style={styles.standingsHeaderText}>Points</Text>
                <Text style={styles.standingsHeaderText}>Diff</Text>
                <Text style={styles.standingsHeaderText}>Played</Text>
              </View>
              {americanoLeaderboard.map((entry, idx) => (
                <View key={entry.participant.userId} style={styles.standingsRow}>
                  <View style={[
                    styles.standingsRank,
                    idx < 3 && { backgroundColor: Colors.accentGold + '30' },
                  ]}>
                    <Text style={[
                      styles.standingsRankText,
                      idx < 3 && { color: Colors.accentGold },
                    ]}>
                      {idx + 1}
                    </Text>
                  </View>
                  <Text style={[styles.standingsPlayerText, { flex: 2 }]} numberOfLines={1}>
                    {entry.participant.displayName}
                  </Text>
                  <Text style={styles.standingsStatText}>{entry.totalPointsFor}</Text>
                  <Text style={[
                    styles.standingsStatText,
                    entry.pointDiff > 0 && { color: Colors.success },
                    entry.pointDiff < 0 && { color: Colors.danger },
                  ]}>
                    {entry.pointDiff > 0 ? '+' : ''}{entry.pointDiff}
                  </Text>
                  <Text style={styles.standingsStatText}>{entry.matchesPlayed}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Pair View */}
        {leaderboardView === 'pairs' && americanoPairLeaderboard.length > 0 && (
          <View style={styles.standingsCard}>
            <Text style={styles.cardTitle}>Pair Leaderboard</Text>
            <View style={styles.standingsTable}>
              <View style={styles.standingsHeader}>
                <Text style={[styles.standingsHeaderText, { flex: 2 }]}>Pair</Text>
                <Text style={styles.standingsHeaderText}>Points</Text>
                <Text style={styles.standingsHeaderText}>Diff</Text>
                <Text style={styles.standingsHeaderText}>Played</Text>
              </View>
              {americanoPairLeaderboard.map((entry, idx) => {
                const [p1, p2] = entry.participants;
                const pairName = `${p1.displayName.split(' ')[0]} / ${p2.displayName.split(' ')[0]}`;
                
                return (
                  <View key={entry.pairKey} style={styles.standingsRow}>
                    <View style={[
                      styles.standingsRank,
                      idx < 3 && { backgroundColor: Colors.accentGold + '30' },
                    ]}>
                      <Text style={[
                        styles.standingsRankText,
                        idx < 3 && { color: Colors.accentGold },
                      ]}>
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.standingsPlayerText} numberOfLines={1}>
                        {pairName}
                      </Text>
                      <Text style={styles.pairSubtext} numberOfLines={1}>
                        @{p1.username} & @{p2.username}
                      </Text>
                    </View>
                    <Text style={styles.standingsStatText}>{entry.totalPointsFor}</Text>
                    <Text style={[
                      styles.standingsStatText,
                      entry.pointDiff > 0 && { color: Colors.success },
                      entry.pointDiff < 0 && { color: Colors.danger },
                    ]}>
                      {entry.pointDiff > 0 ? '+' : ''}{entry.pointDiff}
                    </Text>
                    <Text style={styles.standingsStatText}>{entry.matchesPlayed}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Complete Tournament Button */}
        {tournament && tournament.state === 'in_progress' && userId === tournament.createdByUserId && (
          <View style={styles.actionsCard}>
            <Text style={styles.helperText}>
              Complete the tournament when all rounds are finished
            </Text>
            <Button
              title={completingTournament ? 'Completing...' : 'Complete Tournament'}
              onPress={handleCompleteTournament}
              fullWidth
              disabled={completingTournament}
              icon={completingTournament ? <LoadingSpinner size={20} /> : undefined}
            />
          </View>
        )}

        {/* Rating Summary Modal */}
        {ratingDeltas && (
          <View style={styles.ratingSummaryCard}>
            <View style={styles.ratingSummaryHeader}>
              <MaterialIcons name="emoji-events" size={32} color={Colors.accentGold} />
              <Text style={styles.ratingSummaryTitle}>Rating Changes Applied</Text>
            </View>
            <Text style={styles.ratingSummarySubtitle}>
              Based on final leaderboard placements
            </Text>
            <View style={styles.ratingDeltasList}>
              {ratingDeltas.map((delta, idx) => (
                <View key={delta.userId} style={styles.ratingDeltaRow}>
                  <Text style={styles.ratingDeltaRank}>#{idx + 1}</Text>
                  <Text style={styles.ratingDeltaName} numberOfLines={1}>
                    {delta.displayName}
                  </Text>
                  <Text style={[
                    styles.ratingDeltaValue,
                    delta.delta > 0 && { color: Colors.success },
                    delta.delta < 0 && { color: Colors.danger },
                  ]}>
                    {delta.delta > 0 ? '+' : ''}{delta.delta}
                  </Text>
                </View>
              ))}</View>
            <Button
              title="Dismiss"
              onPress={() => setRatingDeltas(null)}
              variant="secondary"
              fullWidth
            />
          </View>
        )}
      </ScrollView>
    );
  };

  const renderPlayersTab = () => {
    if (!tournament) return null;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.participantsCard}>
          <Text style={styles.cardTitle}>
            All Players ({tournament.participants.length})
          </Text>
          <View style={styles.participantsList}>
            {tournament.participants.map((participant) => (
              <View key={participant.userId} style={styles.participantRow}>
                <UserAvatar
                  name={participant.displayName}
                  avatarUrl={participant.avatarUrl}
                  size={40}
                />
                <UserName
                  profile={{
                    id: participant.userId,
                    displayName: participant.displayName,
                    username: participant.username,
                  }}
                  displayNameStyle={styles.participantName}
                />
                {participant.userId === tournament.createdByUserId && (
                  <View style={styles.creatorBadge}>
                    <Text style={styles.creatorBadgeText}>Creator</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderGroupsTab = () => {
    if (groups.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Groups will appear after tournament starts</Text>
        </View>
      );
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Selector */}
        {groups.length > 1 && (
          <View style={styles.groupSelector}>
            {groups.map(group => (
              <Pressable
                key={group.id}
                style={[
                  styles.groupTab,
                  selectedGroupId === group.id && styles.groupTabActive,
                ]}
                onPress={() => setSelectedGroupId(group.id)}
              >
                <Text style={[
                  styles.groupTabText,
                  selectedGroupId === group.id && styles.groupTabTextActive,
                ]}>
                  {group.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {selectedGroup && (
          <>
            {/* Standings */}
            <View style={styles.standingsCard}>
              <Text style={styles.cardTitle}>Standings</Text>
              <View style={styles.standingsTable}>
                <View style={styles.standingsHeader}>
                  <Text style={[styles.standingsHeaderText, { flex: 2 }]}>Player</Text>
                  <Text style={styles.standingsHeaderText}>W</Text>
                  <Text style={styles.standingsHeaderText}>L</Text>
                  <Text style={styles.standingsHeaderText}>Sets</Text>
                </View>
                {groupStandings.map((standing, idx) => (
                  <View key={standing.participant.userId} style={styles.standingsRow}>
                    <View style={styles.standingsRank}>
                      <Text style={styles.standingsRankText}>{idx + 1}</Text>
                    </View>
                    <Text style={[styles.standingsPlayerText, { flex: 2 }]} numberOfLines={1}>
                      {standing.participant.displayName}
                    </Text>
                    <Text style={styles.standingsStatText}>{standing.wins}</Text>
                    <Text style={styles.standingsStatText}>{standing.losses}</Text>
                    <Text style={styles.standingsStatText}>
                      {standing.setsWon}–{standing.setsLost}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Matches */}
            <View style={styles.matchesCard}>
              <Text style={styles.cardTitle}>Matches</Text>
              {groupMatches.map(match => renderMatchCard(match))}
            </View>
          </>
        )}
      </ScrollView>
    );
  };

  const renderPlayoffsTab = () => {
    if (playoffMatches.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Playoffs will appear after group stage completes</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.matchesCard}>
          <Text style={styles.cardTitle}>Playoff Bracket</Text>
          {playoffMatches.map(match => renderMatchCard(match))}
        </View>
      </ScrollView>
    );
  };

  const renderMatchesTab = () => {
    if (allMatches.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Matches will appear after tournament starts</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {allMatches.map(match => renderMatchCard(match))}
      </ScrollView>
    );
  };

  const renderMatchCard = (match: TournamentMatch) => {
    const teamANames = match.teamA.members?.map(m => m.displayName).join(' / ') || 'Team A';
    const teamBNames = match.teamB.members?.map(m => m.displayName).join(' / ') || 'Team B';
    const scoreDisplay = tournament?.type === 'americano' && match.score.length > 0
      ? `${match.score[0].a} - ${match.score[0].b}`
      : match.score.map(s => `${s.a}–${s.b}`).join(' ');
    
    const isParticipant = match.teamA.memberUserIds.includes(userId || '') || 
                          match.teamB.memberUserIds.includes(userId || '');
    const hasConfirmed = match.confirmedByUserIds.includes(userId || '');
    const canConfirm = isParticipant && match.status === 'submitted' && !hasConfirmed;

    return (
      <View key={match.id} style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <View style={styles.matchStage}>
            <Text style={styles.matchStageText}>
              {tournament?.type === 'americano' 
                ? `Round ${match.roundIndex + 1}`
                : match.stage === 'group' ? 'Group Stage' : 'Playoff'}
            </Text>
          </View>
          <View style={[
            styles.matchStatus,
            match.status === 'confirmed' && styles.matchStatusConfirmed,
            match.status === 'submitted' && styles.matchStatusSubmitted,
          ]}>
            <Text style={styles.matchStatusText}>
              {match.status === 'confirmed' ? 'Confirmed' : 
               match.status === 'submitted' ? 'Awaiting Confirmation' : 
               'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.matchTeams}>
          <Text style={styles.matchTeamName} numberOfLines={1}>{teamANames}</Text>
          <Text style={styles.matchVs}>vs</Text>
          <Text style={styles.matchTeamName} numberOfLines={1}>{teamBNames}</Text>
        </View>

        {scoreDisplay && (
          <Text style={styles.matchScore}>{scoreDisplay}</Text>
        )}

        {match.status === 'pending' && isParticipant && (
          <Button
            title={tournament?.type === 'americano' ? 'Enter Points' : 'Enter Score'}
            onPress={() => router.push(
              tournament?.type === 'americano' 
                ? `/tournaments/americano-points?matchId=${match.id}`
                : `/tournaments/match-score?matchId=${match.id}`
            )}
            variant="secondary"
            fullWidth
            icon={<MaterialIcons name="edit" size={16} color={Colors.textPrimary} />}
          />
        )}

        {canConfirm && (
          <Button
            title="Confirm Result"
            onPress={() => handleConfirmMatch(match.id)}
            fullWidth
          />
        )}

        {match.status === 'submitted' && hasConfirmed && (
          <View style={styles.confirmedBadge}>
            <MaterialIcons name="check-circle" size={16} color={Colors.success} />
            <Text style={styles.confirmedText}>You confirmed this result</Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Tournament</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScreenLoader message="Loading tournament..." />
      </View>
    );
  }

  if (error || !tournament) {
    // Handle 3 states: not_found, access_pending, generic error
    let errorMessage = error || 'Tournament not found';
    let errorTitle = 'Something went wrong';
    let canRetry = true;
    
    if (notFoundState === 'access_pending') {
      errorTitle = 'Not Ready Yet';
      errorMessage = "We couldn't load the tournament yet. It may have just been created or you may have just joined. Pull to refresh or open it again in a moment.";
      canRetry = true;
    } else if (notFoundState === 'not_found') {
      errorTitle = 'Not Found';
      errorMessage = 'This tournament no longer exists or you do not have access to it.';
      canRetry = false;
    }
    
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Tournament</Text>
          <View style={{ width: 24 }} />
        </View>
        
        {/* Custom error state with better messaging */}
        <View style={styles.errorContainer}>
          <MaterialIcons 
            name={notFoundState === 'access_pending' ? 'hourglass-empty' : 'error-outline'} 
            size={64} 
            color={Colors.textMuted} 
          />
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          
          <View style={styles.errorActions}>
            {canRetry && (
              <Button
                title="Retry"
                onPress={loadTournament}
                icon={<MaterialIcons name="refresh" size={20} color={Colors.textPrimary} />}
              />
            )}
            <Button
              title="Go Back"
              onPress={() => router.back()}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    );
  }

  const showTabs = tournament.state === 'in_progress' || tournament.state === 'completed';
  const isAmericano = tournament.type === 'americano';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Tournament</Text>
        {userId === tournament.createdByUserId && tournament.state !== 'completed' && tournament.state !== 'in_progress' ? (
          <Pressable onPress={() => setShowDeleteConfirm(true)} disabled={deletingTournament}>
            <MaterialIcons name="delete" size={24} color={deletingTournament ? Colors.textMuted : Colors.danger} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {showTabs && (
        <ScrollView 
          horizontal 
          style={styles.tabs}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: Spacing.sm }}
        >
          <Pressable
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Overview
            </Text>
          </Pressable>
          
          {isAmericano ? (
            <>
              <Pressable
                style={[styles.tab, activeTab === 'rounds' && styles.tabActive]}
                onPress={() => setActiveTab('rounds')}
              >
                <Text style={[styles.tabText, activeTab === 'rounds' && styles.tabTextActive]}>
                  Rounds
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
                onPress={() => setActiveTab('leaderboard')}
              >
                <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
                  Leaderboard
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'players' && styles.tabActive]}
                onPress={() => setActiveTab('players')}
              >
                <Text style={[styles.tabText, activeTab === 'players' && styles.tabTextActive]}>
                  Players
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
                onPress={() => setActiveTab('groups')}
              >
                <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
                  Groups
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'playoffs' && styles.tabActive]}
                onPress={() => setActiveTab('playoffs')}
              >
                <Text style={[styles.tabText, activeTab === 'playoffs' && styles.tabTextActive]}>
                  Playoffs
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
                onPress={() => setActiveTab('matches')}
              >
                <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
                  Matches
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'rounds' && renderRoundsTab()}
      {activeTab === 'leaderboard' && renderLeaderboardTab()}
      {activeTab === 'players' && renderPlayersTab()}
      {activeTab === 'groups' && renderGroupsTab()}
      {activeTab === 'playoffs' && renderPlayoffsTab()}
      {activeTab === 'matches' && renderMatchesTab()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialIcons name="warning" size={48} color={Colors.danger} />
            <Text style={styles.modalTitle}>Delete Tournament?</Text>
            <Text style={styles.modalMessage}>
              This action cannot be undone. All matches, invites, and tournament data will be permanently deleted.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={handleDeleteTournament}
              >
                <Text style={styles.modalButtonTextDelete}>Delete</Text>
              </Pressable>
            </View>
          </View>
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
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  tabs: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.xs,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  sportIconLarge: {
    width: 48,
    height: 48,
  },
  infoHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  tournamentTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  metaDivider: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  stateChip: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  stateChipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  participantsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  participantsList: {
    gap: Spacing.md,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  participantName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  creatorBadge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  creatorBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  actionsCard: {
    gap: Spacing.md,
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  lockedText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  placeholderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  placeholderTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  placeholderText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  roundSection: {
    gap: Spacing.md,
  },
  roundTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  groupSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  groupTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  groupTabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  groupTabTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  standingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  standingsTable: {
    gap: Spacing.xs,
  },
  standingsHeader: {
    flexDirection: 'row',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  standingsHeaderText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    textAlign: 'center',
    width: 50,
  },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  standingsRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standingsRankText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  standingsPlayerText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  standingsStatText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
    width: 50,
  },
  matchesCard: {
    gap: Spacing.md,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchStage: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  matchStageText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  matchStatus: {
    backgroundColor: Colors.textMuted + '20',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  matchStatusConfirmed: {
    backgroundColor: Colors.success + '20',
  },
  matchStatusSubmitted: {
    backgroundColor: Colors.warning + '20',
  },
  matchStatusText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
  },
  matchTeams: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  matchTeamName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  matchVs: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weights.bold,
  },
  matchScore: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  confirmedText: {
    fontSize: Typography.sizes.sm,
    color: Colors.success,
    fontWeight: Typography.weights.medium,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  viewToggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  viewToggleText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  viewToggleTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  pairSubtext: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ratingSummaryCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.accentGold,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  ratingSummaryHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratingSummaryTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  ratingSummarySubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  ratingDeltasList: {
    gap: Spacing.sm,
  },
  ratingDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  ratingDeltaRank: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.accentGold,
    width: 32,
  },
  ratingDeltaName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  ratingDeltaValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    gap: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  modalMessage: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginTop: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonDelete: {
    backgroundColor: Colors.danger,
  },
  modalButtonTextCancel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  modalButtonTextDelete: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  errorTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
