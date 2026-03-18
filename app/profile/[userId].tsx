import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { matchesService } from '@/services/matches';
import { Sport } from '@/constants/config';

const supabase = getSupabaseClient();

interface PlayerStats {
  level: number;
  reliability: number;
  wins: number;
  losses: number;
  winPercentage: number;
  totalMatches: number;
}

interface RatingHistoryPoint {
  id: string;
  level: number;
  createdAt: string;
}

interface RecentMatch {
  id: string;
  won: boolean;
  opponentName: string;
  scoreDisplay: string;
  ratingDelta: number | null;
  isCompetitive: boolean;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId, groupId, sport, period } = useLocalSearchParams<{
    userId: string;
    groupId: string;
    sport: Sport;
    period: 'monthly' | 'alltime';
  }>();

  const [username, setUsername] = useState('');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPoint[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId, groupId, sport, period]);

  const loadData = async () => {
    if (!userId || !groupId || !sport) return;

    try {
      setLoading(true);
      // Get user info
      const { data: user } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', userId)
        .single();

      setUsername(user?.username || 'Player');

      // Get current rating
      const { data: rating } = await supabase
        .from('user_ratings')
        .select('*')
        .eq('user_id', userId)
        .eq('sport', sport)
        .single();

      // Get match stats
      const { data: playerMatches } = await supabase
        .from('match_players')
        .select('match_id, team, match:match_id(id, winner_team, status, sport, group_id, created_at, type)')
        .eq('user_id', userId);

      const confirmedMatches = (playerMatches || [])
        .filter((pm: any) => 
          pm.match?.status === 'confirmed' &&
          pm.match?.sport === sport &&
          pm.match?.group_id === groupId
        )
        .filter((pm: any) => {
          if (period === 'monthly') {
            const now = new Date();
            const matchDate = new Date(pm.match.created_at);
            return matchDate.getMonth() === now.getMonth() &&
                   matchDate.getFullYear() === now.getFullYear();
          }
          return true;
        });

      const wins = confirmedMatches.filter((pm: any) => pm.team === pm.match.winner_team).length;
      const losses = confirmedMatches.length - wins;

      setStats({
        level: rating?.level || 0,
        reliability: rating?.reliability || 0,
        wins,
        losses,
        winPercentage: confirmedMatches.length > 0 ? (wins / confirmedMatches.length) * 100 : 0,
        totalMatches: confirmedMatches.length,
      });

      // Get rating history
      let historyQuery = supabase
        .from('rating_history')
        .select('id, new_level, created_at')
        .eq('user_id', userId)
        .eq('sport', sport)
        .order('created_at', { ascending: true })
        .limit(10);

      if (period === 'monthly') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        historyQuery = historyQuery.gte('created_at', startOfMonth);
      }

      const { data: history } = await historyQuery;

      setRatingHistory((history || []).map((h: any) => ({
        id: h.id,
        level: h.new_level,
        createdAt: h.created_at,
      })));

      // Get recent matches with details
      const recentMatchIds = confirmedMatches
        .slice(0, 3)
        .map((pm: any) => pm.match_id);

      if (recentMatchIds.length > 0) {
        const { data: matchesData } = await supabase
          .from('matches')
          .select(`
            id,
            type,
            winner_team,
            match_players(user_id, team, user:user_id(username)),
            match_sets(set_number, team_a_score, team_b_score)
          `)
          .in('id', recentMatchIds);

        const { data: ratingChanges } = await supabase
          .from('rating_history')
          .select('match_id, new_level, previous_level')
          .eq('user_id', userId)
          .eq('sport', sport)
          .in('match_id', recentMatchIds);

        const ratingMap = new Map(
          (ratingChanges || []).map((r: any) => [
            r.match_id,
            r.new_level - r.previous_level,
          ])
        );

        const matches: RecentMatch[] = (matchesData || []).map((m: any) => {
          const myPlayer = m.match_players.find((p: any) => p.user_id === userId);
          const opponentPlayer = m.match_players.find((p: any) => p.user_id !== userId);
          const won = myPlayer?.team === m.winner_team;

          // Build score display
          const sets = (m.match_sets || [])
            .sort((a: any, b: any) => a.set_number - b.set_number)
            .map((s: any) => `${s.team_a_score}–${s.team_b_score}`)
            .join(' ');

          return {
            id: m.id,
            won,
            opponentName: opponentPlayer?.user?.username || 'Unknown',
            scoreDisplay: sets || 'No score',
            ratingDelta: m.type === 'competitive' && m.status === 'confirmed' ? (ratingMap.get(m.id) || null) : null,
            isCompetitive: m.type === 'competitive',
          };
        });

        setRecentMatches(matches);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderTrendChart = () => {
    if (ratingHistory.length < 2) {
      return (
        <View style={styles.noChartContainer}>
          <Text style={styles.noChartText}>No competitive matches yet</Text>
        </View>
      );
    }

    // Simple text-based trend display
    const firstLevel = ratingHistory[0].level;
    const lastLevel = ratingHistory[ratingHistory.length - 1].level;
    const delta = lastLevel - firstLevel;
    const trend = delta > 0 ? '📈' : delta < 0 ? '📉' : '➡️';

    return (
      <View style={styles.trendDisplay}>
        <Text style={styles.trendEmoji}>{trend}</Text>
        <View style={styles.trendStats}>
          <Text style={styles.trendLabel}>Started: {firstLevel.toFixed(1)}</Text>
          <Text style={styles.trendLabel}>Current: {lastLevel.toFixed(1)}</Text>
          <Text style={[
            styles.trendDelta,
            delta > 0 ? styles.trendDeltaPositive : delta < 0 ? styles.trendDeltaNegative : {},
          ]}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading || !stats) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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

      {/* User Pill */}
      <View style={styles.userPillContainer}>
        <View style={styles.userPill}>
          <Text style={styles.userPillText}>{username}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat Cards Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardHalf]}>
            <Text style={styles.statLabel}>LEVEL</Text>
            <Text style={styles.statValue}>{stats.level.toFixed(1)}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHalf]}>
            <Text style={styles.statLabel}>RELIABILITY</Text>
            <Text style={[styles.statValue, styles.statValueAccent]}>
              {(stats.reliability * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Period Stats Card */}
        <View style={styles.periodCard}>
          <View style={styles.periodHeader}>
            <Text style={styles.periodLabel}>
              {period === 'monthly' ? 'THIS MONTH' : 'ALL-TIME'}
            </Text>
            <Text style={styles.periodMatchesLabel}>MATCHES</Text>
          </View>
          <View style={styles.periodContent}>
            <Text style={styles.periodRecord}>
              {stats.wins}W – {stats.losses}L
            </Text>
            <Text style={styles.periodWinRate}>
              {stats.winPercentage.toFixed(0)}% win
            </Text>
            <Text style={styles.periodMatchesValue}>{stats.totalMatches}</Text>
          </View>
        </View>

        {/* Level Trend Card */}
        <View style={styles.trendCard}>
          <Text style={styles.trendLabel}>LEVEL TREND</Text>
          {renderTrendChart()}
        </View>

        {/* Recent Matches Card */}
        <View style={styles.recentCard}>
          <Text style={styles.recentLabel}>RECENT MATCHES</Text>
          {recentMatches.length === 0 ? (
            <Text style={styles.noMatchesText}>No matches yet</Text>
          ) : (
            <View style={styles.matchesList}>
              {recentMatches.map((match) => (
                <View key={match.id} style={styles.matchRow}>
                  <View style={[
                    styles.matchResultBadge,
                    match.won ? styles.matchWinBadge : styles.matchLossBadge,
                  ]}>
                    <Text style={styles.matchResultText}>
                      {match.won ? 'W' : 'L'}
                    </Text>
                  </View>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchOpponent}>vs {match.opponentName}</Text>
                    <Text style={styles.matchScore}>{match.scoreDisplay}</Text>
                  </View>
                  <Text style={[
                    styles.matchDelta,
                    match.ratingDelta !== null && (match.ratingDelta > 0 ? styles.matchDeltaPositive : styles.matchDeltaNegative),
                  ]}>
                    {match.ratingDelta !== null
                      ? (match.ratingDelta > 0 ? '+' : '') + match.ratingDelta.toFixed(1)
                      : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Your level changes from confirmed competitive matches (not friendly matches).
          </Text>
          <Text style={[styles.infoText, { marginTop: Spacing.xs, fontSize: Typography.sizes.xs }]}>
            Win more to climb. Tougher opponents = bigger gains.
          </Text>
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
  headerLogo: {
    width: 32,
    height: 32,
  },
  userPillContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userPill: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  userPillText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  statCardHalf: {
    flex: 1,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  statValueAccent: {
    color: '#00D9FF', // Aqua accent for reliability
  },
  periodCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  periodLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  periodMatchesLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  periodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  periodRecord: {
    fontSize: 24,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  periodWinRate: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: '#4ADE80', // Green for win rate
  },
  periodMatchesValue: {
    fontSize: 28,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  trendCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  trendLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  trendDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  trendEmoji: {
    fontSize: 48,
  },
  trendStats: {
    flex: 1,
    gap: Spacing.xs,
  },
  trendLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  trendDelta: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
  },
  trendDeltaPositive: {
    color: '#4ADE80',
  },
  trendDeltaNegative: {
    color: '#F87171',
  },
  noChartContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  noChartText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  recentLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  noMatchesText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  matchesList: {
    gap: Spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  matchResultBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchWinBadge: {
    backgroundColor: '#4ADE80',
  },
  matchLossBadge: {
    backgroundColor: '#FBBF24',
  },
  matchResultText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  matchInfo: {
    flex: 1,
    gap: 2,
  },
  matchOpponent: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  matchScore: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  matchDelta: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.textMuted,
    minWidth: 50,
    textAlign: 'right',
  },
  matchDeltaPositive: {
    color: '#4ADE80',
  },
  matchDeltaNegative: {
    color: '#F87171',
  },
  infoCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  infoText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
