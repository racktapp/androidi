import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, UserAvatar, UserName } from '@/components';
import { useGroups } from '@/hooks/useGroups';
import { useMatches } from '@/hooks/useMatches';
import { Group, GroupMember, Match } from '@/types';
import { Sport } from '@/constants/config';
import { matchesService } from '@/services/matches';
import { getUserLabel } from '@/utils/getUserLabel';

const supabase = getSupabaseClient();

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupsHook = useGroups();
  const matchesHook = useMatches();

  const [userId, setUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'monthly' | 'alltime'>('monthly');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedSport, setSelectedSport] = useState<Sport>('tennis');
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'tournaments'>('overview');
  const [matchFilter, setMatchFilter] = useState<'all' | 'competitive' | 'friendly'>('all');
  const [matchSportFilter, setMatchSportFilter] = useState<'all' | Sport>('all');
  const [matchSort, setMatchSort] = useState<'newest' | 'oldest'>('newest');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentFilter, setTournamentFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [tournamentSort, setTournamentSort] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadGroupData = useCallback(async () => {
    if (!id) return;

    setIsInitialLoading(true);
    try {
      const groupData = await groupsHook.getGroupById(id);
      setGroup(groupData);

      const membersData = await groupsHook.getGroupMembers(id);
      setMembers(membersData);

      const matchesData = await matchesHook.getGroupMatches(id, 50); // Load more for filtering
      setMatches(matchesData);

      // Load group tournaments
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('group_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      setTournaments(tournamentsData || []);
    } finally {
      setIsInitialLoading(false);
    }
  }, [groupsHook, id, matchesHook]);

  const loadLeaderboard = useCallback(async () => {
    if (!id) return;
    try {
      const data = await matchesService.getLeaderboard(id, selectedSport, leaderboardPeriod);
      setLeaderboard(data.slice(0, 5)); // Top 5
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    }
  }, [id, leaderboardPeriod, selectedSport]);

  useEffect(() => {
    if (userId && id) {
      void loadGroupData();
    }
  }, [id, loadGroupData, userId]);

  useEffect(() => {
    if (id) {
      void loadLeaderboard();
    }
  }, [id, loadLeaderboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGroupData();
    await loadLeaderboard();
    setRefreshing(false);
  };

  // Filtered and sorted matches
  const filteredMatches = useMemo(() => {
    let filtered = [...matches];

    // Apply type filter
    if (matchFilter !== 'all') {
      filtered = filtered.filter(m => m.type === matchFilter);
    }

    // Apply sport filter
    if (matchSportFilter !== 'all') {
      filtered = filtered.filter(m => m.sport === matchSportFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at).getTime();
      const dateB = new Date(b.createdAt || b.created_at).getTime();
      return matchSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [matches, matchFilter, matchSportFilter, matchSort]);

  // Filtered and sorted tournaments


  const getMatchPlayerName = (player: any) => {
    const candidate = player?.user || player;
    const label = getUserLabel(candidate).displayName;
    return label === 'Unknown' ? null : label.split(' ')[0];
  };

  const getTeamLabel = (players: any[] = []) => {
    const names = players
      .map(getMatchPlayerName)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join(' / ') : 'Unknown player';
  };

  const getMatchupLabel = (match: Match) => {
    const teamAPlayers = match.players?.filter((player: any) => player.team === 'A') || [];
    const teamBPlayers = match.players?.filter((player: any) => player.team === 'B') || [];

    return `${getTeamLabel(teamAPlayers)} vs ${getTeamLabel(teamBPlayers)}`;
  };

  const filteredTournaments = useMemo(() => {
    let filtered = [...tournaments];

    // Apply status filter
    if (tournamentFilter === 'active') {
      filtered = filtered.filter(t =>
        t.state === 'draft' || t.state === 'inviting' || t.state === 'locked' || t.state === 'in_progress'
      );
    } else if (tournamentFilter === 'completed') {
      filtered = filtered.filter(t => t.state === 'completed');
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return tournamentSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [tournaments, tournamentFilter, tournamentSort]);

  if (!userId || !id) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isInitialLoading && !refreshing) {
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
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.initialLoadingState}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading group...</Text>
          <View style={styles.loadingSkeletonCard} />
          <View style={styles.loadingSkeletonRow} />
          <View style={styles.loadingSkeletonRow} />
        </View>
      </View>
    );
  }

  if (!group && !isInitialLoading && !refreshing) {
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
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>❌</Text>
          <Text style={styles.emptyTitle}>Group Not Found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>{group.name}</Text>
        <Pressable onPress={() => router.push('/settings')}>
          <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
        </Pressable>
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
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>
            Matches ({matches.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'tournaments' && styles.tabActive]}
          onPress={() => setActiveTab('tournaments')}
        >
          <Text style={[styles.tabText, activeTab === 'tournaments' && styles.tabTextActive]}>
            Tournaments ({tournaments.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {activeTab === 'overview' && (
          <>
        {/* Group Cover Section */}
        <View style={styles.coverSection}>
          <View style={styles.coverGradient}>
            <View style={styles.groupAvatarLarge}>
              <MaterialIcons name="group" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.groupNameLarge}>{group.name}</Text>
            <View style={styles.groupMetaRow}>
              <View style={styles.metaBadgeLarge}>
                <MaterialIcons name="sports-tennis" size={16} color={Colors.textMuted} />
                <Text style={styles.metaTextLarge}>
                  {group.sportFocus === 'mixed' ? 'Tennis & Padel' : 
                   group.sportFocus.charAt(0).toUpperCase() + group.sportFocus.slice(1)}
                </Text>
              </View>
              <Text style={styles.metaDotLarge}>•</Text>
              <View style={styles.metaBadgeLarge}>
                <MaterialIcons name="people" size={16} color={Colors.textMuted} />
                <Text style={styles.metaTextLarge}>{members.length} members</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Members Horizontal Scroll */}
        {members.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Members</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.membersScroll}
            >
              {members.map(member => (
                <View key={member.userId} style={styles.memberChip}>
                  <UserAvatar
                    name={member.user?.displayName || member.user?.username}
                    avatarUrl={member.user?.avatarUrl}
                    size={40}
                  />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.user?.displayName?.split(' ')[0] || member.user?.username}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Leaderboard Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleGroup}>
              <Pressable
                style={[styles.toggle, leaderboardPeriod === 'monthly' && styles.toggleActive]}
                onPress={() => setLeaderboardPeriod('monthly')}
              >
                <Text style={[
                  styles.toggleText,
                  leaderboardPeriod === 'monthly' && styles.toggleTextActive,
                ]}>
                  Monthly
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, leaderboardPeriod === 'alltime' && styles.toggleActive]}
                onPress={() => setLeaderboardPeriod('alltime')}
              >
                <Text style={[
                  styles.toggleText,
                  leaderboardPeriod === 'alltime' && styles.toggleTextActive,
                ]}>
                  All-Time
                </Text>
              </Pressable>
            </View>

            <View style={styles.toggleGroup}>
              <Pressable
                style={[styles.toggle, selectedSport === 'tennis' && styles.toggleActive]}
                onPress={() => setSelectedSport('tennis')}
              >
                <Text style={[
                  styles.toggleText,
                  selectedSport === 'tennis' && styles.toggleTextActive,
                ]}>
                  Tennis
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, selectedSport === 'padel' && styles.toggleActive]}
                onPress={() => setSelectedSport('padel')}
              >
                <Text style={[
                  styles.toggleText,
                  selectedSport === 'padel' && styles.toggleTextActive,
                ]}>
                  Padel
                </Text>
              </Pressable>
            </View>
          </View>

          {leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>No data yet</Text>
          ) : (
            <View style={styles.leaderboardList}>
              {leaderboard.map(entry => (
                <View key={entry.userId} style={styles.leaderboardRow}>
                  <View style={[
                    styles.rankBadge,
                    entry.rank === 1 && styles.rankBadgeFirst,
                    entry.rank === 2 && styles.rankBadgeSecond,
                    entry.rank === 3 && styles.rankBadgeThird,
                  ]}>
                    <Text style={[
                      styles.rankText,
                      entry.rank <= 3 && styles.rankTextTop,
                    ]}>#{entry.rank}</Text>
                  </View>
                  <UserAvatar
                    name={entry.user?.displayName || entry.user?.username}
                    avatarUrl={entry.user?.avatarUrl}
                    size={44}
                  />
                  <View style={styles.playerInfo}>
                    <UserName
                      profile={entry.user}
                      displayNameStyle={styles.playerName}
                      numberOfLines={1}
                    />
                    <Text style={styles.record}>
                      {entry.wins}W–{entry.losses}L • {entry.winPercentage.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.stats}>
                    <Text style={styles.level}>{entry.level.toFixed(1)}</Text>
                    <Text style={styles.reliability}>
                      {(entry.reliability * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Activity Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {matches.length === 0 && tournaments.length === 0 ? (
            <Text style={styles.emptyText}>No activity yet</Text>
          ) : (
            <View style={styles.activityPreview}>
              {matches.slice(0, 3).map(match => (
                <Pressable
                  key={match.id}
                  style={styles.activityCard}
                  onPress={() => router.push(`/match/${match.id}`)}
                >
                  <MaterialIcons name="sports-tennis" size={16} color={Colors.primary} />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)} Match
                    </Text>
                    <Text style={styles.activitySubtitle} numberOfLines={1}>
                      {getMatchupLabel(match)}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusDot,
                    match.status === 'confirmed' ? styles.statusDotConfirmed : styles.statusDotPending,
                  ]} />
                </Pressable>
              ))}
              {tournaments.slice(0, 2).map((tournament: any) => (
                <Pressable
                  key={tournament.id}
                  style={styles.activityCard}
                  onPress={() => router.push(`/tournaments/${tournament.id}`)}
                >
                  <MaterialIcons name="emoji-events" size={16} color={Colors.accentGold} />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {tournament.title}
                    </Text>
                    <Text style={styles.activitySubtitle} numberOfLines={1}>
                      {tournament.type === 'americano' ? 'Americano' : 'Tournament'} · {tournament.state}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
          </>
        )}

        {activeTab === 'matches' && (
          <>
            {/* Match Filters */}
            <View style={styles.filtersSection}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Type</Text>
                <View style={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, matchFilter === 'all' && styles.filterChipActive]}
                    onPress={() => setMatchFilter('all')}
                  >
                    <Text style={[styles.filterChipText, matchFilter === 'all' && styles.filterChipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, matchFilter === 'competitive' && styles.filterChipActive]}
                    onPress={() => setMatchFilter('competitive')}
                  >
                    <Text style={[styles.filterChipText, matchFilter === 'competitive' && styles.filterChipTextActive]}>
                      Competitive
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, matchFilter === 'friendly' && styles.filterChipActive]}
                    onPress={() => setMatchFilter('friendly')}
                  >
                    <Text style={[styles.filterChipText, matchFilter === 'friendly' && styles.filterChipTextActive]}>
                      Friendly
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sport</Text>
                <View style={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, matchSportFilter === 'all' && styles.filterChipActive]}
                    onPress={() => setMatchSportFilter('all')}
                  >
                    <Text style={[styles.filterChipText, matchSportFilter === 'all' && styles.filterChipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, matchSportFilter === 'tennis' && styles.filterChipActive]}
                    onPress={() => setMatchSportFilter('tennis')}
                  >
                    <Text style={[styles.filterChipText, matchSportFilter === 'tennis' && styles.filterChipTextActive]}>
                      Tennis
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, matchSportFilter === 'padel' && styles.filterChipActive]}
                    onPress={() => setMatchSportFilter('padel')}
                  >
                    <Text style={[styles.filterChipText, matchSportFilter === 'padel' && styles.filterChipTextActive]}>
                      Padel
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sort</Text>
                <View style={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, matchSort === 'newest' && styles.filterChipActive]}
                    onPress={() => setMatchSort('newest')}
                  >
                    <Text style={[styles.filterChipText, matchSort === 'newest' && styles.filterChipTextActive]}>
                      Newest
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, matchSort === 'oldest' && styles.filterChipActive]}
                    onPress={() => setMatchSort('oldest')}
                  >
                    <Text style={[styles.filterChipText, matchSort === 'oldest' && styles.filterChipTextActive]}>
                      Oldest
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Matches List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {filteredMatches.length} Match{filteredMatches.length !== 1 ? 'es' : ''}
              </Text>
              {filteredMatches.length === 0 ? (
                <Text style={styles.emptyText}>No matches found</Text>
              ) : (
                <View style={styles.matchesList}>
                  {filteredMatches.map(match => (
                    <Pressable
                      key={match.id}
                      style={styles.matchCard}
                      onPress={() => router.push(`/match/${match.id}`)}
                    >
                      <View style={styles.matchHeader}>
                        <View style={styles.matchInfo}>
                          <Text style={styles.matchSport}>
                            {match.sport.charAt(0).toUpperCase() + match.sport.slice(1)} · {match.format}
                          </Text>
                          <View style={[
                            styles.typeChip,
                            match.type === 'competitive' ? styles.typeChipCompetitive : styles.typeChipFriendly,
                          ]}>
                            <Text style={styles.typeChipText}>
                              {match.type === 'competitive' ? 'Competitive' : 'Friendly'}
                            </Text>
                          </View>
                        </View>
                        <View style={[
                          styles.statusBadge,
                          match.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending,
                        ]}>
                          <Text style={styles.statusText}>{match.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.matchPlayers}>
                        {getMatchupLabel(match)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'tournaments' && (
          <>
            {/* Tournament Filters */}
            <View style={styles.filtersSection}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, tournamentFilter === 'all' && styles.filterChipActive]}
                    onPress={() => setTournamentFilter('all')}
                  >
                    <Text style={[styles.filterChipText, tournamentFilter === 'all' && styles.filterChipTextActive]}>
                      All
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, tournamentFilter === 'active' && styles.filterChipActive]}
                    onPress={() => setTournamentFilter('active')}
                  >
                    <Text style={[styles.filterChipText, tournamentFilter === 'active' && styles.filterChipTextActive]}>
                      Active
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, tournamentFilter === 'completed' && styles.filterChipActive]}
                    onPress={() => setTournamentFilter('completed')}
                  >
                    <Text style={[styles.filterChipText, tournamentFilter === 'completed' && styles.filterChipTextActive]}>
                      Completed
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sort</Text>
                <View style={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, tournamentSort === 'newest' && styles.filterChipActive]}
                    onPress={() => setTournamentSort('newest')}
                  >
                    <Text style={[styles.filterChipText, tournamentSort === 'newest' && styles.filterChipTextActive]}>
                      Newest
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, tournamentSort === 'oldest' && styles.filterChipActive]}
                    onPress={() => setTournamentSort('oldest')}
                  >
                    <Text style={[styles.filterChipText, tournamentSort === 'oldest' && styles.filterChipTextActive]}>
                      Oldest
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Tournaments List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {filteredTournaments.length} Tournament{filteredTournaments.length !== 1 ? 's' : ''}
              </Text>
              {filteredTournaments.length === 0 ? (
                <Text style={styles.emptyText}>No tournaments found</Text>
              ) : (
                <View style={styles.tournamentsList}>
                  {filteredTournaments.map((tournament: any) => (
                    <Pressable
                      key={tournament.id}
                      style={styles.tournamentCard}
                      onPress={() => router.push(`/tournaments/${tournament.id}`)}
                    >
                      <View style={styles.tournamentHeader}>
                        <Image
                          source={tournament.sport === 'tennis' 
                            ? require('@/assets/icons/tennis_icon.png')
                            : require('@/assets/icons/padel_icon.png')}
                          style={styles.tournamentSportIcon}
                          contentFit="contain"
                          transition={0}
                        />
                        <Text style={styles.tournamentTitle} numberOfLines={1}>
                          {tournament.title}
                        </Text>
                      </View>
                      <View style={styles.tournamentMeta}>
                        <Text style={styles.tournamentMetaText}>
                          {tournament.type === 'americano' ? 'Americano' : 'Tournament'} · {tournament.mode === 'singles' ? 'Singles' : 'Doubles'}
                        </Text>
                        <View style={[
                          styles.tournamentState,
                          tournament.state === 'completed' && styles.tournamentStateCompleted,
                          tournament.state === 'in_progress' && styles.tournamentStateActive,
                        ]}>
                          <Text style={styles.tournamentStateText}>
                            {tournament.state === 'draft' ? 'Draft' :
                             tournament.state === 'inviting' ? 'Inviting' :
                             tournament.state === 'locked' ? 'Locked' :
                             tournament.state === 'in_progress' ? 'In Progress' :
                             'Completed'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tournamentFooter}>
                        <MaterialIcons name="people" size={14} color={Colors.textMuted} />
                        <Text style={styles.tournamentParticipants}>
                          {tournament.participants.length} players
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.stickyButton}>
          <Pressable
            style={({ pressed }) => [
              styles.logMatchButton,
              pressed && styles.logMatchButtonPressed,
            ]}
            onPress={() => router.push('/(tabs)/add-match')}
          >
            <MaterialIcons name="add-circle" size={24} color={Colors.textPrimary} />
            <Text style={styles.logMatchButtonText}>Log Match</Text>
          </Pressable>
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
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
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
  loadingText: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  initialLoadingState: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  loadingSkeletonCard: {
    height: 120,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingSkeletonRow: {
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coverSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  coverGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: `${Colors.primary}10`,
  },
  groupAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary + '40',
  },
  groupNameLarge: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaTextLarge: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  metaDotLarge: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  membersScroll: {
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  memberChip: {
    alignItems: 'center',
    gap: Spacing.xs,
    width: 64,
  },
  memberName: {
    fontSize: Typography.sizes.xs,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
  },
  toggle: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  leaderboardList: {
    gap: Spacing.sm,
  },
  leaderboardRow: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankBadgeFirst: {
    backgroundColor: Colors.accentGold + '20',
    borderColor: Colors.accentGold,
  },
  rankBadgeSecond: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  rankBadgeThird: {
    backgroundColor: Colors.warning + '20',
    borderColor: Colors.warning,
  },
  rankText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  rankTextTop: {
    color: Colors.textPrimary,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  stats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  level: {
    fontSize: 24,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  reliability: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  record: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  matchesList: {
    gap: Spacing.sm,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchSport: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusConfirmed: {
    backgroundColor: Colors.success,
  },
  statusPending: {
    backgroundColor: Colors.warning,
  },
  statusText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  matchPlayers: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
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
  filtersSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  filterRow: {
    gap: Spacing.sm,
  },
  filterLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterChip: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeChip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeChipCompetitive: {
    backgroundColor: Colors.accentGold + '20',
  },
  typeChipFriendly: {
    backgroundColor: Colors.surfaceElevated,
  },
  typeChipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  activityPreview: {
    gap: Spacing.sm,
  },
  activityCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  activitySubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotConfirmed: {
    backgroundColor: Colors.success,
  },
  statusDotPending: {
    backgroundColor: Colors.warning,
  },
  tournamentsList: {
    gap: Spacing.sm,
  },
  tournamentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tournamentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tournamentSportIcon: {
    width: 20,
    height: 20,
  },
  tournamentTitle: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tournamentMetaText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  tournamentState: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
  },
  tournamentStateActive: {
    backgroundColor: Colors.success + '20',
  },
  tournamentStateCompleted: {
    backgroundColor: Colors.textMuted + '20',
  },
  tournamentStateText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
  },
  tournamentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tournamentParticipants: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  stickyButton: {
    marginTop: Spacing.md,
  },
  logMatchButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logMatchButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  logMatchButtonText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
});
