import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { UserAvatar, UserName, ScreenLoader, EmptyState, ErrorState, LoadingSpinner } from '@/components';
import { useGroups } from '@/hooks/useGroups';
import { Group, LeaderboardEntry } from '@/types';
import { Sport } from '@/constants/config';
import { getSupabaseClient } from '@/template';
import { matchesService } from '@/services/matches';
import { friendsService } from '@/services/friends';

const supabase = getSupabaseClient();

type TabType = 'group-ranking' | 'head-to-head';

export default function LeaderboardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getUserGroups } = useGroups();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('group-ranking');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport>('tennis');
  const [period, setPeriod] = useState<'monthly' | 'alltime'>('monthly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [friends, setFriends] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [headToHeadStats, setHeadToHeadStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadGroups();
      loadFriends();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedGroup && activeTab === 'group-ranking') {
      loadLeaderboard();
    }
  }, [selectedGroup, selectedSport, period, activeTab]);

  useEffect(() => {
    if (selectedOpponent && activeTab === 'head-to-head') {
      loadHeadToHeadStats();
    }
  }, [selectedOpponent, selectedSport, period, activeTab]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadGroups = async () => {
    if (!userId) return;
    const data = await getUserGroups(userId);
    setGroups(data);
    if (data.length > 0 && !selectedGroup) {
      setSelectedGroup(data[0].id);
    }
  };

  const loadFriends = async () => {
    if (!userId) return;
    try {
      const data = await friendsService.getFriends(userId);
      setFriends(data);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  };

  const loadLeaderboard = async () => {
    if (!selectedGroup) return;
    try {
      setError(null);
      const data = await matchesService.getLeaderboard(selectedGroup, selectedSport, period);
      setLeaderboard(data);
    } catch (err: any) {
      console.error('Error loading leaderboard:', err);
      setError(err.message || 'Failed to load leaderboard');
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const loadHeadToHeadStats = async () => {
    if (!userId || !selectedOpponent) return;

    setLoadingStats(true);
    try {
      const { data: playerRows } = await supabase
        .from('match_players')
        .select(`
          user_id,
          match_id,
          team,
          match:match_id (
            id,
            status,
            winner_team,
            created_at,
            group_id,
            sport
          )
        `)
        .in('user_id', [userId, selectedOpponent]);

      if (!playerRows || playerRows.length === 0) {
        setHeadToHeadStats(null);
        setLoadingStats(false);
        return;
      }

      const matchesById = new Map<string, { match: any; myTeam?: string; opponentTeam?: string }>();

      for (const row of playerRows) {
        const match = Array.isArray(row.match) ? row.match[0] : row.match;

        if (
          !match ||
          match.status !== 'confirmed' ||
          match.sport !== selectedSport
        ) {
          continue;
        }

        const existing = matchesById.get(row.match_id) || { match };

        if (row.user_id === userId) {
          existing.myTeam = row.team;
        }

        if (row.user_id === selectedOpponent) {
          existing.opponentTeam = row.team;
        }

        matchesById.set(row.match_id, existing);
      }

      const validMatches = Array.from(matchesById.values())
        .filter(({ myTeam, opponentTeam }) => Boolean(myTeam && opponentTeam))
        .map(({ match, myTeam, opponentTeam }) => ({
          matchId: match.id,
          iWon: match.winner_team === myTeam,
          opponentWon: match.winner_team === opponentTeam,
          createdAt: match.created_at,
        }));

      let filteredMatches = validMatches;
      if (period === 'monthly') {
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredMatches = validMatches.filter((m: any) => new Date(m.createdAt) >= monthAgo);
      }

      const wins = filteredMatches.filter((m: any) => m.iWon).length;
      const losses = filteredMatches.filter((m: any) => m.opponentWon).length;
      const winRate = filteredMatches.length > 0 ? Math.round((wins / filteredMatches.length) * 100) : 0;

      let currentStreak = 0;
      let streakType: 'W' | 'L' | null = null;
      const sortedMatches = [...filteredMatches].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      for (const match of sortedMatches) {
        if (match.iWon && (!streakType || streakType === 'W')) {
          streakType = 'W';
          currentStreak++;
        } else if (match.opponentWon && (!streakType || streakType === 'L')) {
          streakType = 'L';
          currentStreak++;
        } else {
          break;
        }
      }

      const last5 = sortedMatches.slice(0, 5).map((m: any) => m.iWon ? 'W' : 'L');

      setHeadToHeadStats({
        wins,
        losses,
        winRate,
        streak: currentStreak,
        streakType,
        last5,
        totalMatches: filteredMatches.length,
        recentMatches: sortedMatches.slice(0, 3),
      });
    } catch (err) {
      console.error('Error loading head-to-head stats:', err);
      setHeadToHeadStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'group-ranking') {
      await loadLeaderboard();
    } else {
      await loadHeadToHeadStats();
    }
    setRefreshing(false);
  }, [selectedGroup, selectedSport, period, selectedOpponent, activeTab]);

  const handleRowPress = (entry: LeaderboardEntry) => {
    if (!selectedGroup) return;
    router.push({
      pathname: '/profile/[userId]' as any,
      params: { 
        userId: entry.userId,
        groupId: selectedGroup,
        sport: selectedSport,
        period,
      },
    });
  };

  const currentGroup = groups.find(g => g.id === selectedGroup);
  const selectedFriend = selectedOpponent 
    ? friends.find(f => f.friend.id === selectedOpponent)?.friend 
    : null;

  const userRank = leaderboard.find(e => e.userId === userId);

  if (isLoadingInitial) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
              transition={200}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Leaderboards</Text>
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <ScreenLoader message="Loading leaderboards..." />
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
              transition={200}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Leaderboards</Text>
          <Pressable onPress={() => router.push('/settings')}>
            <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <EmptyState icon="🏆" title="No Groups Yet" subtitle="Join a group to view leaderboards" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Leaderboards</Text>
        <Pressable onPress={() => router.push('/settings')}>
          <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* Compact Controls */}
      <View style={styles.controls}>
        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'group-ranking' && styles.tabActive]}
            onPress={() => setActiveTab('group-ranking')}
          >
            <Text style={[styles.tabText, activeTab === 'group-ranking' && styles.tabTextActive]}>
              Group Ranking
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'head-to-head' && styles.tabActive]}
            onPress={() => setActiveTab('head-to-head')}
          >
            <Text style={[styles.tabText, activeTab === 'head-to-head' && styles.tabTextActive]}>
              Head-to-head
            </Text>
          </Pressable>
        </View>

        {/* Selectors Row */}
        {activeTab === 'group-ranking' ? (
          <Pressable style={styles.groupPill} onPress={() => setShowGroupPicker(true)}>
            <MaterialIcons name="group" size={14} color={Colors.textPrimary} />
            <Text style={styles.groupText} numberOfLines={1}>
              {currentGroup?.name || 'Group'}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={18} color={Colors.textPrimary} />
          </Pressable>
        ) : (
          <Pressable style={styles.opponentPill} onPress={() => setShowOpponentPicker(true)}>
            {selectedFriend ? (
              <>
                <UserAvatar
                  name={selectedFriend.displayName || selectedFriend.username}
                  avatarUrl={selectedFriend.avatarUrl}
                  size={24}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.opponentText} numberOfLines={1}>
                    {selectedFriend.displayName || selectedFriend.username}
                  </Text>
                  <Text style={styles.opponentSubtext}>All matches</Text>
                </View>
              </>
            ) : (
              <Text style={styles.opponentPlaceholder}>Choose opponent</Text>
            )}
            <MaterialIcons name="arrow-drop-down" size={18} color={Colors.textMuted} />
          </Pressable>
        )}

        {/* Mini Controls */}
        <View style={styles.miniControls}>
          <View style={styles.miniGroup}>
            <Pressable
              style={[styles.miniBtn, selectedSport === 'tennis' && styles.miniBtnActive]}
              onPress={() => setSelectedSport('tennis')}
            >
              <Image
                source={require('@/assets/icons/tennis_icon.png')}
                style={[styles.miniIcon, selectedSport !== 'tennis' && styles.miniIconInactive]}
                contentFit="contain"
                transition={0}
              />
            </Pressable>
            <Pressable
              style={[styles.miniBtn, selectedSport === 'padel' && styles.miniBtnActive]}
              onPress={() => setSelectedSport('padel')}
            >
              <Image
                source={require('@/assets/icons/padel_icon.png')}
                style={[styles.miniIcon, selectedSport !== 'padel' && styles.miniIconInactive]}
                contentFit="contain"
                transition={0}
              />
            </Pressable>
          </View>

          <View style={styles.miniGroup}>
            <Pressable
              style={[styles.miniBtn, period === 'monthly' && styles.miniBtnActive]}
              onPress={() => setPeriod('monthly')}
            >
              <Text style={[styles.miniBtnText, period === 'monthly' && styles.miniBtnTextActive]}>
                Month
              </Text>
            </Pressable>
            <Pressable
              style={[styles.miniBtn, period === 'alltime' && styles.miniBtnActive]}
              onPress={() => setPeriod('alltime')}
            >
              <Text style={[styles.miniBtnText, period === 'alltime' && styles.miniBtnTextActive]}>
                All
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {activeTab === 'group-ranking' ? (
          leaderboard.length === 0 ? (
            <EmptyState icon="📊" title="No Data Yet" subtitle="Complete matches to see rankings" />
          ) : (
            <>
              {userRank && (
                <View style={styles.yourRank}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankNumber}>#{userRank.rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.yourLevel}>{userRank.level.toFixed(1)}</Text>
                    <Text style={styles.yourRecord}>
                      {userRank.wins}W–{userRank.losses}L • {userRank.winPercentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.rankedList}>
                {leaderboard.map((entry) => (
                  <Pressable
                    key={entry.userId}
                    style={[
                      styles.rankRow,
                      entry.userId === userId && styles.rankRowHighlighted,
                    ]}
                    onPress={() => handleRowPress(entry)}
                  >
                    <View style={[
                      styles.rankNum,
                      entry.rank <= 3 && styles.rankNumTop,
                    ]}>
                      <Text style={[
                        styles.rankNumText,
                        entry.rank <= 3 && styles.rankNumTextTop,
                      ]}>
                        {entry.rank}
                      </Text>
                    </View>

                    <UserAvatar
                      name={entry.user?.displayName || entry.user?.username}
                      avatarUrl={entry.user?.avatarUrl}
                      size={36}
                    />

                    <View style={styles.rankInfo}>
                      <UserName
                        profile={entry.user}
                        displayNameStyle={styles.rankName}
                        numberOfLines={1}
                      />
                      <Text style={styles.rankRec}>{entry.wins}W–{entry.losses}L</Text>
                    </View>

                    <View style={styles.rankStats}>
                      <Text style={styles.rankLvl}>{entry.level.toFixed(1)}</Text>
                      <Text style={styles.rankWr}>{entry.winPercentage.toFixed(0)}%</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )
        ) : (
          loadingStats ? (
            <View style={styles.loadingBox}>
              <LoadingSpinner size={24} />
            </View>
          ) : headToHeadStats && selectedFriend ? (
            <>
              <View style={styles.recordBox}>
                <Text style={styles.recordBig}>
                  {headToHeadStats.wins}–{headToHeadStats.losses}
                </Text>
                <Text style={styles.recordSmall}>Overall Record</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{headToHeadStats.winRate}%</Text>
                  <Text style={styles.statLbl}>Win Rate</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[
                    styles.statVal,
                    headToHeadStats.streakType === 'W' && { color: Colors.success },
                    headToHeadStats.streakType === 'L' && { color: Colors.danger },
                  ]}>
                    {headToHeadStats.streak}{headToHeadStats.streakType}
                  </Text>
                  <Text style={styles.statLbl}>Streak</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{headToHeadStats.totalMatches}</Text>
                  <Text style={styles.statLbl}>Matches</Text>
                </View>
              </View>

              {headToHeadStats.last5.length > 0 && (
                <View style={styles.last5}>
                  <Text style={styles.last5Title}>Last 5</Text>
                  <View style={styles.last5Row}>
                    {headToHeadStats.last5.map((result: string, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.last5Badge,
                          result === 'W' && { backgroundColor: Colors.success },
                          result === 'L' && { backgroundColor: Colors.danger },
                        ]}
                      >
                        <Text style={styles.last5Text}>{result}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {headToHeadStats.recentMatches && headToHeadStats.recentMatches.length > 0 && (
                <View style={styles.matchList}>
                  {headToHeadStats.recentMatches.map((match: any) => (
                    <Pressable
                      key={match.matchId}
                      style={styles.matchItem}
                      onPress={() => router.push(`/match/${match.matchId}`)}
                    >
                      <View style={[
                        styles.matchBadge,
                        match.iWon && { backgroundColor: Colors.success },
                        match.opponentWon && { backgroundColor: Colors.danger },
                      ]}>
                        <Text style={styles.matchBadgeText}>{match.iWon ? 'W' : 'L'}</Text>
                      </View>
                      <Text style={styles.matchDate}>
                        {new Date(match.createdAt).toLocaleDateString()}
                      </Text>
                      <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : selectedOpponent ? (
            <EmptyState icon="📊" title="No Matches" subtitle="You haven't played this player yet" />
          ) : (
            <EmptyState icon="🎯" title="Select Opponent" subtitle="Choose a player to view stats" />
          )
        )}
      </ScrollView>

      {/* Group Picker Modal */}
      <Modal
        visible={showGroupPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGroupPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGroupPicker(false)}>
          <Pressable
            style={[styles.pickerModal, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Group</Text>
              <Pressable onPress={() => setShowGroupPicker(false)}>
                <MaterialIcons name="close" size={24} color={Colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {groups.map(group => (
                <Pressable
                  key={group.id}
                  style={[
                    styles.pickerItem,
                    selectedGroup === group.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedGroup(group.id);
                    setShowGroupPicker(false);
                  }}
                >
                  <MaterialIcons name="group" size={24} color={Colors.primary} />
                  <Text style={styles.pickerName}>{group.name}</Text>
                  {selectedGroup === group.id && (
                    <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Opponent Picker Modal */}
      <Modal
        visible={showOpponentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOpponentPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowOpponentPicker(false)}>
          <Pressable
            style={[styles.pickerModal, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose Opponent</Text>
              <Pressable onPress={() => setShowOpponentPicker(false)}>
                <MaterialIcons name="close" size={24} color={Colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {friends.map(friendship => (
                <Pressable
                  key={friendship.id}
                  style={[
                    styles.pickerItem,
                    selectedOpponent === friendship.friend.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedOpponent(friendship.friend.id);
                    setShowOpponentPicker(false);
                  }}
                >
                  <UserAvatar
                    name={friendship.friend.displayName || friendship.friend.username}
                    avatarUrl={friendship.friend.avatarUrl}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <UserName
                      profile={friendship.friend}
                      displayNameStyle={styles.pickerName}
                      handleStyle={styles.pickerHandle}
                    />
                  </View>
                  {selectedOpponent === friendship.friend.id && (
                    <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  controls: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },

  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  groupText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  opponentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  opponentText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  opponentSubtext: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  opponentPlaceholder: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
    opacity: 0.6,
  },
  miniControls: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  miniGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
  },
  miniBtn: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  miniBtnActive: {
    backgroundColor: Colors.primary,
  },
  miniIcon: {
    width: 16,
    height: 16,
  },
  miniIconInactive: {
    opacity: 0.5,
  },
  miniBtnText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  miniBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Group Ranking
  yourRank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: Spacing.md,
  },
  rankBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  yourLevel: {
    fontSize: 28,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  yourRecord: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  rankedList: {
    gap: Spacing.xs,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  rankRowHighlighted: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  rankNum: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankNumTop: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  rankNumText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  rankNumTextTop: {
    color: Colors.primary,
  },
  rankInfo: {
    flex: 1,
    gap: 2,
  },
  rankName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  rankRec: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  rankStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rankLvl: {
    fontSize: 24,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  rankWr: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },

  // Head-to-head
  loadingBox: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  recordBox: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  recordBig: {
    fontSize: 40,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  recordSmall: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  statLbl: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  last5: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  last5Title: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
  },
  last5Row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  last5Badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  last5Text: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  matchList: {
    gap: Spacing.xs,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  matchBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  matchDate: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemSelected: {
    backgroundColor: Colors.surfaceElevated,
  },
  pickerName: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  pickerHandle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
});
