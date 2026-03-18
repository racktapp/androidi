import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { ScreenLoader, EmptyState, ErrorState, Avatar } from '@/components';
import { getSupabaseClient } from '@/template';
import { userService } from '@/services/user';
import { tournamentsService } from '@/services/tournaments';
import { Tournament } from '@/types';
import { normalizeMatchSets, calculateSetsWon } from '@/services/matchUtils';
import TournamentsHome from '../tournaments/index';

const supabase = getSupabaseClient();

type TabType = 'overview' | 'tournaments';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [unreadFeedCount, setUnreadFeedCount] = useState<number>(0);
  const [events, setEvents] = useState<any[]>([]);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [lastActiveGroup, setLastActiveGroup] = useState<any>(null);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [tournamentProgress, setTournamentProgress] = useState<any>(null);
  const [recentTournaments, setRecentTournaments] = useState<any[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadInitialData();
    }
  }, [userId, activeTab]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadInitialData = async () => {
    try {
      setError(null);
      await loadOverviewData();
      // Load unread count for bell badge
      if (userId) {
        const pending = await loadPendingMatchesCount();
        setUnreadFeedCount(pending);
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const loadFeed = async () => {
    if (!userId) return;
    try {
      const data = await userService.getFeed(userId);
      setEvents(data);
    } catch (err) {
      console.error('Error loading feed:', err);
    }
  };

  const loadPendingMatchesCount = async (): Promise<number> => {
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

      const pending = (matchPlayers || [])
        .map((mp: any) => mp.match)
        .filter((m: any) => m && m.status === 'pending' && m.created_by !== userId);

      return pending.length;
    } catch (err) {
      console.error('Error loading pending matches count:', err);
      return 0;
    }
  };

  const loadOverviewData = async () => {
    if (!userId) return;
    try {
      // Get this month's stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: matchPlayers } = await supabase
        .from('match_players')
        .select('match_id, team, match:match_id(id, winner_team, status, type, created_at, group_id)')
        .eq('user_id', userId);

      const thisMonthMatches = (matchPlayers || [])
        .filter((mp: any) => 
          mp.match?.status === 'confirmed' &&
          mp.match?.type === 'competitive' &&
          new Date(mp.match.created_at) >= new Date(startOfMonth)
        );

      const wins = thisMonthMatches.filter((mp: any) => mp.team === mp.match.winner_team).length;
      const losses = thisMonthMatches.length - wins;

      setStats({
        wins,
        losses,
        winRate: thisMonthMatches.length > 0 ? Math.round((wins / thisMonthMatches.length) * 100) : 0,
        matchesPlayed: thisMonthMatches.length,
      });

      // Get last active group
      if (thisMonthMatches.length > 0) {
        const lastMatch = thisMonthMatches[thisMonthMatches.length - 1];
        const { data: group } = await supabase
          .from('groups')
          .select('id, name')
          .eq('id', lastMatch.match.group_id)
          .single();

        setLastActiveGroup(group);
      }

      // Get recent competitive results (last 3)
      const recentMatches = (matchPlayers || [])
        .filter((mp: any) => mp.match?.status === 'confirmed' && mp.match?.type === 'competitive')
        .sort((a: any, b: any) => 
          new Date(b.match.created_at).getTime() - new Date(a.match.created_at).getTime()
        )
        .slice(0, 3);

      const resultsWithDetails = await Promise.all(
        recentMatches.map(async (mp: any) => {
          const { data: match } = await supabase
            .from('matches')
            .select(`
              id,
              sport,
              winner_team,
              match_players(user_id, team, user:user_id(username, display_name)),
              match_sets(set_number, team_a_score, team_b_score)
            `)
            .eq('id', mp.match_id)
            .single();

          if (!match) return null;

          const opponentPlayer = match.match_players.find((p: any) => p.user_id !== userId);
          const won = mp.team === match.winner_team;
          const sets = normalizeMatchSets(match);
          const scoreDisplay = sets.map(s => `${s.a}–${s.b}`).join(' ');

          return {
            id: match.id,
            won,
            opponent: opponentPlayer?.user?.display_name || opponentPlayer?.user?.username || 'Unknown',
            score: scoreDisplay,
            sport: match.sport,
          };
        })
      );

      setRecentResults(resultsWithDetails.filter(Boolean));

      // Get tournament summary
      const activeTourn = await tournamentsService.getActiveTournamentForUser(userId);
      setActiveTournament(activeTourn);
      
      if (activeTourn) {
        const progress = await tournamentsService.getTournamentProgress(activeTourn);
        setTournamentProgress(progress);
      }

      const recentTourns = await tournamentsService.getRecentCompletedTournamentsForUser(userId, 3);
      setRecentTournaments(recentTourns);

    } catch (err) {
      console.error('Error loading overview:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, [userId, activeTab]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const renderEvent = (event: any) => {
    let icon = '📢';
    let description = '';

    const groupName = event.group?.name || event.metadata?.group_name || 'a group';
    const userName = event.user?.display_name || event.user?.username || 'Someone';

    if (!event.group?.name && event.group_id) {
      console.warn('[Feed] Missing group name for event:', {
        eventId: event.id,
        eventType: event.event_type,
        groupId: event.group_id,
      });
    }

    switch (event.event_type) {
      case 'match_confirmed':
        icon = '🎾';
        description = `Match confirmed in ${groupName}`;
        break;
      case 'group_created':
        icon = '🏆';
        description = `${userName} created ${groupName}`;
        break;
      case 'group_joined':
        icon = '👋';
        description = `${userName} joined ${groupName}`;
        break;
      default:
        icon = '📢';
        description = 'Activity update';
    }

    return (
      <View key={event.id} style={styles.eventCard}>
        <Text style={styles.eventIcon}>{icon}</Text>
        <View style={styles.eventContent}>
          <Text style={styles.eventDescription}>{description}</Text>
          <Text style={styles.eventTime}>{formatDate(event.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderFeedTab = () => (
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
      {/* Pending Confirmations */}
      {pendingMatches.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.sectionTitle}>Needs Your Confirmation</Text>
          {pendingMatches.map((match) => {
            const sets = normalizeMatchSets(match);
            const { setsWonA, setsWonB } = calculateSetsWon(sets);
            const teamAPlayers = match.players?.filter((p: any) => p.team === 'A') || [];
            const teamBPlayers = match.players?.filter((p: any) => p.team === 'B') || [];

            const getTeamName = (players: any[]) => {
              return players
                .map((p: any) => p.user?.display_name?.split(' ')[0] || p.user?.username || 'Player')
                .join(' / ');
            };

            return (
              <Pressable
                key={match.id}
                style={styles.pendingCard}
                onPress={() => router.push(`/match/${match.id}`)}
              >
                <View style={styles.pendingHeader}>
                  <MaterialIcons name="sports-tennis" size={20} color={Colors.primary} />
                  <Text style={styles.pendingGroup}>{match.group?.name}</Text>
                </View>

                <View style={styles.matchupRow}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {getTeamName(teamAPlayers)}
                  </Text>
                  <Text style={styles.vsText}>vs</Text>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {getTeamName(teamBPlayers)}
                  </Text>
                </View>

                {sets.length > 0 && (
                  <View style={styles.scorePreview}>
                    {sets.map((set, idx) => (
                      <Text key={idx} style={styles.setScore}>
                        {set.a}–{set.b}
                      </Text>
                    ))}
                    <Text style={styles.setsWon}>
                      ({setsWonA}–{setsWonB})
                    </Text>
                  </View>
                )}

                <View style={styles.pendingFooter}>
                  <View style={styles.pendingBadge}>
                    <MaterialIcons name="schedule" size={14} color={Colors.warning} />
                    <Text style={styles.pendingBadgeText}>Awaiting Confirmation</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Activity Feed */}
      {events.length === 0 && pendingMatches.length === 0 ? (
        <EmptyState
          icon="📡"
          title="No Activity Yet"
          subtitle="Add friends and join groups to see activity"
        />
      ) : events.length > 0 ? (
        <View style={styles.eventsSection}>
          {pendingMatches.length > 0 && (
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          )}
          <View style={styles.eventsList}>
            {events.map(renderEvent)}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );

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
                      {activeTournament.title}
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
                    {activeTournament.participants.length} players
                  </Text>
                </View>
                {tournamentProgress && (
                  <View style={styles.tournamentDetailRow}>
                    <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.tournamentDetailText}>
                      {tournamentProgress.stage
                        ? `Stage: ${tournamentProgress.stage}`
                        : `Rounds: ${tournamentProgress.roundsCompleted} / ${tournamentProgress.totalRounds}`
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
              {recentTournaments.map((tournament) => (
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
                      {tournament.title}
                    </Text>
                    <View style={styles.completedTournamentMeta}>
                      <Text style={styles.completedTournamentMetaText}>
                        {tournament.type === 'americano' ? 'Americano' : 'Tournament'}
                      </Text>
                      {tournament.placement && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.completedTournamentPlacement}>
                            {tournament.placement}
                          </Text>
                        </>
                      )}
                      {tournament.ratingDelta !== undefined && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={[
                            styles.completedTournamentDelta,
                            tournament.ratingDelta > 0 && { color: Colors.success },
                            tournament.ratingDelta < 0 && { color: Colors.danger },
                          ]}>
                            {tournament.ratingDelta > 0 ? '+' : ''}{tournament.ratingDelta.toFixed(1)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
                </Pressable>
              ))}
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
                  {result.sport.charAt(0).toUpperCase() + result.sport.slice(1)}
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
