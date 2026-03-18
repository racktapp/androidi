import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { ScreenLoader, EmptyState, ErrorState } from '@/components';
import { getSupabaseClient } from '@/template';
import { userService } from '@/services/user';
import { normalizeMatchSets, calculateSetsWon } from '@/services/matchUtils';

const supabase = getSupabaseClient();

export default function FeedScreen() {
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
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
  }, [userId]);

  const loadInitialData = async () => {
    try {
      setError(null);
      await Promise.all([loadFeed(), loadPendingMatches()]);
    } catch (err: any) {
      console.error('Error loading feed:', err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
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

  const loadPendingMatches = async () => {
    if (!userId) return;
    try {
      // Get matches where user is a player but not the creator
      const { data: matchPlayers } = await supabase
        .from('match_players')
        .select(`
          match:match_id (
            id,
            sport,
            format,
            type,
            status,
            created_by,
            group:group_id (id, name),
            players:match_players(
              id,
              team,
              user:user_id (id, username, display_name)
            ),
            sets:match_sets(
              set_number,
              team_a_score,
              team_b_score
            )
          )
        `)
        .eq('user_id', userId);

      // Filter to pending matches where user is not the creator
      const pending = (matchPlayers || [])
        .map((mp: any) => mp.match)
        .filter((m: any) => m && m.status === 'pending' && m.created_by !== userId)
        .sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setPendingMatches(pending);
    } catch (err) {
      console.error('Error loading pending matches:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadPendingMatches()]);
    setRefreshing(false);
  }, [userId]);

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

    switch (event.event_type) {
      case 'match_confirmed':
        icon = '🎾';
        description = `Match confirmed in ${event.group?.name}`;
        break;
      case 'group_created':
        icon = '🏆';
        description = `${event.user?.display_name || event.user?.username} created ${event.group?.name}`;
        break;
      case 'group_joined':
        icon = '👋';
        description = `${event.user?.display_name || event.user?.username} joined ${event.group?.name}`;
        break;
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

  if (isLoadingInitial) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Activity Feed</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScreenLoader message="Loading activity..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Activity Feed</Text>
          <View style={{ width: 24 }} />
        </View>
        <ErrorState message={error} onRetry={loadInitialData} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Activity Feed</Text>
        <View style={{ width: 24 }} />
      </View>

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
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
  pendingSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
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
});
