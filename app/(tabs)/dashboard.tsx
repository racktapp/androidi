import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { ScreenLoader, EmptyState, ErrorState } from '@/components';
import { getSupabaseClient } from '@/template';
import { tournamentsService } from '@/services/tournaments';
import { Tournament } from '@/types';
import { normalizeMatchSets } from '@/services/matchUtils';
import TournamentsHome from '../tournaments/index';

const supabase = getSupabaseClient();

type TabType = 'overview' | 'tournaments';

type DashboardStats = {
  wins: number;
  losses: number;
  winRate: number;
  matchesPlayed: number;
};

type DashboardGroupSummary = {
  id: string;
  name: string;
};

type DashboardRecentResult = {
  id: string;
  won: boolean;
  opponent: string;
  score: string;
  sport: string | null;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const unwrapRelation = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const asNonEmptyString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const asFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const isValidDateValue = (value: unknown): value is string | number | Date => {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const getSportLabel = (sport: unknown): string => {
  if (typeof sport !== 'string' || sport.trim().length === 0) {
    return 'Unknown';
  }

  const normalized = sport.trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getPlayerLabel = (user: any, fallback = 'Unknown'): string =>
  asNonEmptyString(user?.display_name, '') ||
  asNonEmptyString(user?.displayName, '') ||
  asNonEmptyString(user?.username, fallback);

const getTournamentTitle = (title: unknown): string => asNonEmptyString(title, 'Untitled tournament');

const getTournamentParticipantCount = (participants: unknown): number => asArray(participants).length;

const getRatingDeltaLabel = (value: unknown): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [unreadFeedCount, setUnreadFeedCount] = useState<number>(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lastActiveGroup, setLastActiveGroup] = useState<DashboardGroupSummary | null>(null);
  const [recentResults, setRecentResults] = useState<DashboardRecentResult[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [tournamentProgress, setTournamentProgress] = useState<any>(null);
  const [recentTournaments, setRecentTournaments] = useState<any[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    } catch (err: any) {
      console.error('Error loading dashboard user:', err);
      setError(err?.message || 'Failed to load dashboard');
      setIsLoadingInitial(false);
    }
  };

  const loadPendingMatchesCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;
    try {
      const { data: matchPlayers } = await supabase
        .from('match_players')
        .select(`
          match:match_id (
            id,
            status,
            created_by
          )
        `)
        .eq('user_id', userId);

      const pending = asArray<any>(matchPlayers)
        .map((matchPlayer) => unwrapRelation(matchPlayer?.match))
        .filter((match): match is any => Boolean(match))
        .filter((match) => match.status === 'pending' && match.created_by !== userId);

      return pending.length;
    } catch (err) {
      console.error('Error loading pending matches count:', err);
      return 0;
    }
  }, [userId]);

  const loadOverviewData = useCallback(async () => {
    if (!userId) return;
    try {
      // Get this month's stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: matchPlayers } = await supabase
        .from('match_players')
        .select('match_id, team, match:match_id(id, winner_team, status, type, created_at, group_id)')
        .eq('user_id', userId);

      const normalizedMatchPlayers = asArray<any>(matchPlayers)
        .map((matchPlayer) => {
          const match = unwrapRelation(matchPlayer?.match);
          return match ? { ...matchPlayer, match } : null;
        })
        .filter((matchPlayer): matchPlayer is { match_id: string; team: 'A' | 'B'; match: any } => {
          if (!matchPlayer?.match) {
            return false;
          }

          if (!isValidDateValue(matchPlayer.match.created_at)) {
            return false;
          }

          return true;
        });

      const thisMonthMatches = normalizedMatchPlayers.filter(
        (matchPlayer) =>
          matchPlayer.match.status === 'confirmed' &&
          matchPlayer.match.type === 'competitive' &&
          new Date(matchPlayer.match.created_at) >= new Date(startOfMonth)
      );

      const wins = thisMonthMatches.filter((matchPlayer) => matchPlayer.team === matchPlayer.match.winner_team).length;
      const losses = thisMonthMatches.length - wins;

      setStats({
        wins,
        losses,
        winRate: thisMonthMatches.length > 0 ? Math.round((wins / thisMonthMatches.length) * 100) : 0,
        matchesPlayed: thisMonthMatches.length,
      });

      if (thisMonthMatches.length > 0) {
        const lastMatch = thisMonthMatches[thisMonthMatches.length - 1];
        const lastMatchData = unwrapRelation(lastMatch.match);
        const { data: group } = await supabase
          .from('groups')
          .select('id, name')
          .eq('id', lastMatchData?.group_id)
          .single();

        setLastActiveGroup(
          group
            ? {
                id: asNonEmptyString(group.id, ''),
                name: asNonEmptyString(group.name, 'Unnamed group'),
              }
            : null
        );
      } else {
        setLastActiveGroup(null);
      }

      const recentMatches = normalizedMatchPlayers
        .filter((matchPlayer) => matchPlayer.match.status === 'confirmed' && matchPlayer.match.type === 'competitive')
        .sort(
          (a, b) => new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime()
        )
        .slice(0, 3);

      const recentMatchIds = recentMatches
        .map((match) => match.match_id)
        .filter((matchId): matchId is string => typeof matchId === 'string' && matchId.length > 0);
      const { data: recentMatchDetails } = recentMatchIds.length > 0
        ? await supabase
            .from('matches')
            .select(`
              id,
              sport,
              winner_team,
              match_players(user_id, team, user:user_id(username, display_name)),
              match_sets(set_number, team_a_score, team_b_score)
            `)
            .in('id', recentMatchIds)
        : { data: [] as any[] };

      const recentMatchMap = new Map(
        asArray<any>(recentMatchDetails)
          .filter((match) => typeof match?.id === 'string' && match.id.length > 0)
          .map((match) => [match.id, match] as const)
      );

      const resultsWithDetails = recentMatches.map((matchPlayer) => {
        const match = recentMatchMap.get(matchPlayer.match_id);

        if (!match) return null;

        const opponentPlayer = asArray<any>(match.match_players).find(
          (player) => player?.user_id !== userId
        );
        const won = matchPlayer.team === match.winner_team;
        const sets = normalizeMatchSets(match);
        const scoreDisplay = sets.length > 0 ? sets.map((set) => `${set.a}–${set.b}`).join(' ') : 'Score unavailable';

        return {
          id: asNonEmptyString(match.id, `${matchPlayer.match_id}`),
          won,
          opponent: getPlayerLabel(opponentPlayer?.user, 'Unknown'),
          score: scoreDisplay,
          sport: typeof match.sport === 'string' ? match.sport : null,
        };
      });

      setRecentResults(
        resultsWithDetails.filter((result): result is DashboardRecentResult => Boolean(result))
      );

      const activeTourn = await tournamentsService.getActiveTournamentForUser(userId);
      setActiveTournament(activeTourn);

      if (activeTourn) {
        const progress = await tournamentsService.getTournamentProgress(activeTourn);
        setTournamentProgress(progress);
      } else {
        setTournamentProgress(null);
      }

      const recentTourns = await tournamentsService.getRecentCompletedTournamentsForUser(userId, 3);
      setRecentTournaments(recentTourns);
      setError(null);
    } catch (err: any) {
      console.error('Error loading overview:', err);
      setStats(null);
      setLastActiveGroup(null);
      setRecentResults([]);
      setActiveTournament(null);
      setTournamentProgress(null);
      setRecentTournaments([]);
      setError(err?.message || 'Failed to load dashboard');
    }
  }, [userId]);

  const loadInitialData = useCallback(async () => {
    try {
      setError(null);
      const pendingCountPromise = userId
        ? loadPendingMatchesCount().then(setUnreadFeedCount)
        : Promise.resolve();

      if (activeTab === 'overview') {
        await Promise.all([loadOverviewData(), pendingCountPromise]);
      } else {
        await pendingCountPromise;
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setIsLoadingInitial(false);
    }
  }, [activeTab, loadOverviewData, loadPendingMatchesCount, userId]);

  useEffect(() => {
    if (userId) {
      void loadInitialData();
    }
  }, [activeTab, loadInitialData, userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, [loadInitialData]);

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Tournaments Summary */}
      {(activeTournament || recentTournaments.length > 0) && (
        <View style={styles.tournamentsCard}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>TOURNAMENTS</Text>
            <Pressable
              style={styles.createTournamentButton}
              onPress={() => {
                setActiveTab('tournaments');
                setTimeout(() => router.push('/tournaments/create'), 100);
              }}
            >
              <MaterialIcons name="add" size={16} color={Colors.primary} />
              <Text style={styles.createTournamentText}>Create</Text>
            </Pressable>
          </View>

          {/* Active Tournament */}
          {activeTournament && (
            <Pressable
              style={styles.activeTournamentCard}
              onPress={() => router.push(`/tournaments/${activeTournament.id}`)}
            >
              <View style={styles.tournamentHeader}>
                <View style={styles.tournamentTitleRow}>
                  <Image
                    source={activeTournament.sport === 'tennis' 
                      ? require('@/assets/icons/tennis_icon.png')
                      : require('@/assets/icons/padel_icon.png')
                    }
                    style={styles.tournamentSportIcon}
                    contentFit="contain"
                    transition={0}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tournamentTitle} numberOfLines={1}>
                      {getTournamentTitle(activeTournament.title)}
                    </Text>
                    <View style={styles.tournamentMeta}>
                      <Text style={styles.tournamentMetaText}>
                        {activeTournament.type === 'americano' ? 'Americano' : 'Tournament'}
                      </Text>
                      {activeTournament.isCompetitive && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <MaterialIcons name="star" size={12} color={Colors.accentGold} />
                          <Text style={[styles.tournamentMetaText, { color: Colors.accentGold }]}>
                            Competitive
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
                <View style={[styles.tournamentState, 
                  activeTournament.state === 'in_progress' && { backgroundColor: Colors.success + '20' },
                  activeTournament.state === 'locked' && { backgroundColor: Colors.primary + '20' },
                  activeTournament.state === 'inviting' && { backgroundColor: Colors.warning + '20' },
                ]}>
                  <Text style={[styles.tournamentStateText,
                    activeTournament.state === 'in_progress' && { color: Colors.success },
                    activeTournament.state === 'locked' && { color: Colors.primary },
                    activeTournament.state === 'inviting' && { color: Colors.warning },
                  ]}>
                    {activeTournament.state === 'in_progress' ? 'In Progress' :
                     activeTournament.state === 'locked' ? 'Locked' :
                     activeTournament.state === 'inviting' ? 'Inviting' : 'Draft'}
                  </Text>
                </View>
              </View>

              <View style={styles.tournamentDetails}>
                <View style={styles.tournamentDetailRow}>
                  <MaterialIcons name="people" size={14} color={Colors.textMuted} />
                  <Text style={styles.tournamentDetailText}>
                    {getTournamentParticipantCount(activeTournament.participants)} players
                  </Text>
                </View>
                {tournamentProgress && (
                  <View style={styles.tournamentDetailRow}>
                    <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.tournamentDetailText}>
                      {asNonEmptyString(tournamentProgress?.stage, '')
                        ? `Stage: ${tournamentProgress.stage}`
                        : `Rounds: ${asFiniteNumber(tournamentProgress?.roundsCompleted)} / ${asFiniteNumber(tournamentProgress?.totalRounds)}`
                      }
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.tournamentCTA}>
                <Text style={styles.tournamentCTAText}>Open</Text>
                <MaterialIcons name="chevron-right" size={16} color={Colors.primary} />
              </View>
            </Pressable>
          )}

          {/* Recent Completed Tournaments */}
          {recentTournaments.length > 0 && (
            <View style={styles.recentTournamentsSection}>
              {activeTournament && (
                <Text style={styles.recentTournamentsTitle}>Recent Completed</Text>
              )}
              {recentTournaments.map((tournament) => {
                const ratingDeltaLabel = getRatingDeltaLabel(tournament?.ratingDelta);

                return (
                  <Pressable
                    key={tournament.id}
                    style={styles.completedTournamentRow}
                    onPress={() => router.push(`/tournaments/${tournament.id}`)}
                  >
                    <Image
                      source={tournament.sport === 'tennis'
                        ? require('@/assets/icons/tennis_icon.png')
                        : require('@/assets/icons/padel_icon.png')
                      }
                      style={styles.completedTournamentIcon}
                      contentFit="contain"
                      transition={0}
                    />
                    <View style={styles.completedTournamentInfo}>
                      <Text style={styles.completedTournamentTitle} numberOfLines={1}>
                        {getTournamentTitle(tournament?.title)}
                      </Text>
                      <View style={styles.completedTournamentMeta}>
                        <Text style={styles.completedTournamentMetaText}>
                          {tournament.type === 'americano' ? 'Americano' : 'Tournament'}
                        </Text>
                        {asNonEmptyString(tournament?.placement, '') && (
                          <>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.completedTournamentPlacement}>
                              {tournament.placement}
                            </Text>
                          </>
                        )}
                        {ratingDeltaLabel && (
                          <>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={[
                              styles.completedTournamentDelta,
                              typeof tournament?.ratingDelta === 'number' && tournament.ratingDelta > 0 && { color: Colors.success },
                              typeof tournament?.ratingDelta === 'number' && tournament.ratingDelta < 0 && { color: Colors.danger },
                            ]}>
                              {ratingDeltaLabel}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsCard}>
        <Text style={styles.cardTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/add-match')}
          >
            <MaterialIcons name="add-circle" size={32} color={Colors.primary} />
            <Text style={styles.actionText}>Log Match</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push('/create-group')}
          >
            <MaterialIcons name="group-add" size={32} color={Colors.primary} />
            <Text style={styles.actionText}>Create Group</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              setActiveTab('tournaments');
              setTimeout(() => router.push('/tournaments/create'), 100);
            }}
          >
            <MaterialIcons name="emoji-events" size={32} color={Colors.primary} />
            <Text style={styles.actionText}>New Tournament</Text>
          </Pressable>
        </View>
      </View>

      {/* This Month Stats */}
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>THIS MONTH</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.wins}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.losses}</Text>
              <Text style={styles.statLabel}>Losses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.winRate}<Text style={styles.percentSymbol}>%</Text></Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.matchesPlayed}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
          </View>
        </View>
      )}

      {/* Last Active Group */}
      {lastActiveGroup && (
        <View style={styles.groupCard}>
          <Text style={styles.cardTitle}>LAST ACTIVE GROUP</Text>
          <Pressable
            style={styles.groupButton}
            onPress={() => router.push(`/group/${lastActiveGroup.id}`)}
          >
            <View style={styles.groupInfo}>
              <MaterialIcons name="group" size={24} color={Colors.textPrimary} />
              <Text style={styles.groupName}>{lastActiveGroup.name}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
          </Pressable>
        </View>
      )}

      {/* Recent Competitive Results */}
      {recentResults.length > 0 && (
        <View style={styles.resultsCard}>
          <Text style={styles.cardTitle}>RECENT RESULTS</Text>
          <View style={styles.resultsList}>
            {recentResults.map((result) => (
              <Pressable
                key={result.id}
                style={styles.resultRow}
                onPress={() => router.push(`/match/${result.id}`)}
              >
                <View style={[
                  styles.resultBadge,
                  result.won ? styles.resultWin : styles.resultLoss,
                ]}>
                  <Text style={styles.resultBadgeText}>
                    {result.won ? 'W' : 'L'}
                  </Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultOpponent}>vs {result.opponent}</Text>
                  <Text style={styles.resultScore}>{result.score}</Text>
                </View>
                <Text style={styles.resultSport}>
                  {getSportLabel(result.sport)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {!stats && !lastActiveGroup && recentResults.length === 0 && (
        <EmptyState
          icon="🎾"
          title="Welcome to Rackt!"
          subtitle="Start by creating a group and logging your first match"
        />
      )}
    </ScrollView>
  );

  if (isLoadingInitial) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.headerLogo}
              contentFit="contain"
              transition={200}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Overview
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'tournaments' && styles.tabActive]}
            onPress={() => setActiveTab('tournaments')}
          >
            <Text style={[styles.tabText, activeTab === 'tournaments' && styles.tabTextActive]}>
              Tournaments
            </Text>
          </Pressable>
        </View>
        <ScreenLoader message="Loading dashboard..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.headerLogo}
              contentFit="contain"
              transition={200}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
              Overview
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'tournaments' && styles.tabActive]}
            onPress={() => setActiveTab('tournaments')}
          >
            <Text style={[styles.tabText, activeTab === 'tournaments' && styles.tabTextActive]}>
              Tournaments
            </Text>
          </Pressable>
        </View>
        <ErrorState message={error} onRetry={loadInitialData} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => {
          setActiveTab('overview');
          router.push('/(tabs)/dashboard');
        }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
            transition={200}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <Pressable onPress={() => router.push('/(tabs)/feed')}>
            <View>
              <MaterialIcons name="notifications" size={24} color={Colors.textPrimary} />
              {unreadFeedCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadFeedCount > 9 ? '9+' : unreadFeedCount}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'tournaments' && styles.tabActive]}
          onPress={() => setActiveTab('tournaments')}
        >
          <Text style={[styles.tabText, activeTab === 'tournaments' && styles.tabTextActive]}>
            Tournaments
          </Text>
        </Pressable>
      </View>

      {activeTab === 'overview' ? renderOverviewTab() : <TournamentsHome />}
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
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
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

  // Feed styles
  pendingSection: {
    gap: Spacing.md,
  },
  eventsSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  pendingCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.warning,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pendingGroup: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  teamName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  vsText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  scorePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  setScore: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  setsWon: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.bold,
  },
  pendingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pendingBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.warning,
  },
  eventsList: {
    gap: Spacing.md,
  },
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  eventIcon: {
    fontSize: 32,
  },
  eventContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  eventDescription: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  eventTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },

  // Overview styles
  actionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  actionButton: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  percentSymbol: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  groupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  groupName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  resultsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  resultsList: {
    gap: Spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  resultBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultWin: {
    backgroundColor: Colors.success,
  },
  resultLoss: {
    backgroundColor: Colors.danger,
  },
  resultBadgeText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultOpponent: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  resultScore: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  resultSport: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },

  // Tournament styles
  tournamentsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createTournamentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  createTournamentText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  activeTournamentCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tournamentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tournamentTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tournamentSportIcon: {
    width: 20,
    height: 20,
  },
  tournamentTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tournamentMetaText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  metaDot: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  tournamentState: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  tournamentStateText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  tournamentDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  tournamentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tournamentDetailText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  tournamentCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tournamentCTAText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  recentTournamentsSection: {
    gap: Spacing.sm,
  },
  recentTournamentsTitle: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  completedTournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
  },
  completedTournamentIcon: {
    width: 16,
    height: 16,
  },
  completedTournamentInfo: {
    flex: 1,
    gap: 2,
  },
  completedTournamentTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  completedTournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedTournamentMetaText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  completedTournamentPlacement: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  completedTournamentDelta: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
});
