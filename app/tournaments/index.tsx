import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { ScreenLoader, EmptyState, ErrorState, UserAvatar, UserName, LoadingSpinner } from '@/components';
import { useAlert } from '@/template';
import { tournamentsService } from '@/services/tournaments';
import { Tournament, TournamentInvite } from '@/types';
import { getSupabaseClient } from '@/template';
import { useGroups } from '@/hooks/useGroups';
import { friendsService } from '@/services/friends';

const supabase = getSupabaseClient();

type TabType = 'overview' | 'events';

export default function TournamentsHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { getUserGroups } = useGroups();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([]);
  const [completedTournaments, setCompletedTournaments] = useState<Tournament[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TournamentInvite[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondingToInvite, setRespondingToInvite] = useState<string | null>(null);



  // Events tab state
  const [eventsView, setEventsView] = useState<'my-groups' | 'all'>('my-groups');
  const [eventsStatus, setEventsStatus] = useState<'ongoing' | 'completed'>('ongoing');

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadTournaments();
      loadGroups();
    }
  }, [userId]);



  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };



  const loadTournaments = async () => {
    if (!userId) return;
    try {
      setError(null);
      const [tournamentsData, invitesData] = await Promise.all([
        tournamentsService.listTournamentsForUser(userId),
        tournamentsService.getPendingInvitesForUser(userId),
      ]);

      setActiveTournaments(tournamentsData.active);
      setCompletedTournaments(tournamentsData.completed);
      setPendingInvites(invitesData);
    } catch (err: any) {
      console.error('Error loading tournaments:', err);
      setError(err.message || 'Failed to load tournaments');
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const loadGroups = async () => {
    if (!userId) return;
    try {
      const groupsData = await getUserGroups(userId);
      setGroups(groupsData);
    } catch (err: any) {
      console.error('Error loading groups:', err);
    }
  };



  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTournaments(), loadGroups()]);
    setRefreshing(false);
  }, [userId]);

  const handleRespondToInvite = async (inviteId: string, accept: boolean) => {
    setRespondingToInvite(inviteId);
    
    try {
      const result = await tournamentsService.respondToInvite(inviteId, accept);
      await loadTournaments();
      
      if (accept) {
        if (result.ok && result.joined && result.participantRecordFound && result.tournamentId) {
          showAlert('Success', 'You have joined the tournament!');
          router.push(`/tournaments/${result.tournamentId}`);
        } else {
          showAlert('Invite Accepted', 'Tournament will appear shortly.');
        }
      } else {
        showAlert('Invite Declined', 'You have declined the tournament invitation.');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to respond to invite');
    } finally {
      setRespondingToInvite(null);
    }
  };

  const getStateLabel = (state: Tournament['state']) => {
    switch (state) {
      case 'draft': return 'Draft';
      case 'inviting': return 'Inviting';
      case 'locked': return 'Locked';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return state;
    }
  };

  const getStateColor = (state: Tournament['state']) => {
    switch (state) {
      case 'draft': return Colors.textMuted;
      case 'inviting': return Colors.warning;
      case 'locked': return Colors.primary;
      case 'in_progress': return Colors.success;
      case 'completed': return Colors.textMuted;
      default: return Colors.textMuted;
    }
  };

  const renderOverviewTab = () => {
    const recentTournament = [...activeTournaments, ...completedTournaments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <View style={styles.invitesSection}>
            {pendingInvites.map((invite) => (
              <View key={invite.id} style={styles.inviteCard}>
                <View style={styles.inviteRow}>
                  <MaterialIcons name="mail" size={18} color={Colors.warning} />
                  <Text style={styles.inviteTitle}>{invite.tournament?.title || 'Tournament'}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable
                    style={styles.inviteDecline}
                    onPress={() => handleRespondToInvite(invite.id, false)}
                    disabled={respondingToInvite !== null}
                  >
                    <Text style={styles.inviteDeclineText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={styles.inviteAccept}
                    onPress={() => handleRespondToInvite(invite.id, true)}
                    disabled={respondingToInvite !== null}
                  >
                    <Text style={styles.inviteAcceptText}>Accept</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Stats Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{activeTournaments.length}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{completedTournaments.length}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
        </View>



        {/* Recent Tournament */}
        {recentTournament && (
          <Pressable
            style={styles.tournamentHighlight}
            onPress={() => router.push(`/tournaments/${recentTournament.id}`)}
          >
            <View style={styles.highlightHeader}>
              <Image
                source={recentTournament.sport === 'tennis' 
                  ? require('@/assets/icons/tennis_icon.png')
                  : require('@/assets/icons/padel_icon.png')
                }
                style={styles.highlightIcon}
                contentFit="contain"
                transition={0}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.highlightTitle}>{recentTournament.title}</Text>
                <Text style={styles.highlightMeta}>
                  {getStateLabel(recentTournament.state)} • {recentTournament.participants.length} players
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </View>
          </Pressable>
        )}

        {/* Quick Action to Leaderboards */}
        <Pressable style={styles.recordsShortcut} onPress={() => router.push('/(tabs)/leaderboards')}>
          <MaterialIcons name="leaderboard" size={20} color={Colors.primary} />
          <Text style={styles.shortcutText}>View Rankings & Records</Text>
          <MaterialIcons name="arrow-forward" size={18} color={Colors.primary} />
        </Pressable>

        {(!recentTournament && pendingInvites.length === 0) && (
          <EmptyState
            icon="🏆"
            title="No Tournament Activity"
            subtitle="Create a tournament or join a group to get started"
          />
        )}
      </ScrollView>
    );
  };



  const renderEventsTab = () => {
    let filteredTournaments = [...activeTournaments, ...completedTournaments];

    if (eventsStatus === 'ongoing') {
      filteredTournaments = filteredTournaments.filter(t => 
        t.state === 'draft' || t.state === 'inviting' || t.state === 'locked' || t.state === 'in_progress'
      );
    } else {
      filteredTournaments = filteredTournaments.filter(t => t.state === 'completed');
    }

    if (eventsView === 'my-groups') {
      const myGroupIds = groups.map(g => g.id);
      filteredTournaments = filteredTournaments.filter(t => 
        t.groupId && myGroupIds.includes(t.groupId)
      );
    }

    filteredTournaments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Filters */}
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Pressable
              style={[styles.filterChip, eventsView === 'my-groups' && styles.filterChipActive]}
              onPress={() => setEventsView('my-groups')}
            >
              <Text style={[styles.filterText, eventsView === 'my-groups' && styles.filterTextActive]}>
                My Groups
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, eventsView === 'all' && styles.filterChipActive]}
              onPress={() => setEventsView('all')}
            >
              <Text style={[styles.filterText, eventsView === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </Pressable>
          </View>

          <View style={styles.filterGroup}>
            <Pressable
              style={[styles.filterChip, eventsStatus === 'ongoing' && styles.filterChipActive]}
              onPress={() => setEventsStatus('ongoing')}
            >
              <Text style={[styles.filterText, eventsStatus === 'ongoing' && styles.filterTextActive]}>
                Ongoing
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, eventsStatus === 'completed' && styles.filterChipActive]}
              onPress={() => setEventsStatus('completed')}
            >
              <Text style={[styles.filterText, eventsStatus === 'completed' && styles.filterTextActive]}>
                Completed
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Events List */}
        {filteredTournaments.length > 0 ? (
          <View style={styles.eventsList}>
            {filteredTournaments.map((tournament) => (
              <Pressable
                key={tournament.id}
                style={styles.eventCard}
                onPress={() => router.push(`/tournaments/${tournament.id}`)}
              >
                <View style={styles.eventHeader}>
                  <Image
                    source={tournament.sport === 'tennis' 
                      ? require('@/assets/icons/tennis_icon.png')
                      : require('@/assets/icons/padel_icon.png')
                    }
                    style={styles.eventIcon}
                    contentFit="contain"
                    transition={0}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{tournament.title}</Text>
                    <Text style={styles.eventMeta}>
                      {tournament.type === 'americano' ? 'Americano' : 'Tournament'} • {tournament.participants.length} players
                    </Text>
                  </View>
                  <View style={[styles.eventBadge, { backgroundColor: getStateColor(tournament.state) + '20' }]}>
                    <Text style={[styles.eventBadgeText, { color: getStateColor(tournament.state) }]}>
                      {getStateLabel(tournament.state)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState icon="🏆" title="No Tournaments" subtitle="No tournaments match your filters" />
        )}
      </ScrollView>
    );
  };

  if (isLoadingInitial) {
    return <ScreenLoader message="Loading tournaments..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadTournaments} />;
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Events
          </Text>
        </Pressable>
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'events' && renderEventsTab()}


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },

  // Overview
  invitesSection: {
    gap: Spacing.sm,
  },
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.warning,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  inviteTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inviteDecline: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
  inviteDeclineText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  inviteAccept: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  inviteAcceptText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  summaryLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },

  tournamentHighlight: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  highlightIcon: {
    width: 24,
    height: 24,
  },
  highlightTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  highlightMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  recordsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    padding: Spacing.md,
  },
  shortcutText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },



  // Events
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  eventsList: {
    gap: Spacing.sm,
  },
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventIcon: {
    width: 18,
    height: 18,
  },
  eventTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  eventMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  eventBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  eventBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
});
