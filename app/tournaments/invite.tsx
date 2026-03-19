import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, UserAvatar, UserName, ScreenLoader, EmptyState, LoadingSpinner } from '@/components';
import { tournamentsService } from '@/services/tournaments';
import { friendsService } from '@/services/friends';
import { Tournament } from '@/types';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

type TabType = 'friends' | 'search';

export default function InvitePlayersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadData = useCallback(async () => {
    if (!userId || !id || typeof id !== 'string') return;

    try {
      setError(null);
      const [tournamentData, friendsData] = await Promise.all([
        tournamentsService.getTournamentById(id),
        friendsService.getFriends(userId),
      ]);

      setTournament(tournamentData);
      setFriends(friendsData);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [id, userId]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await friendsService.searchUsers(searchQuery.trim());
      // Filter out current user, existing participants, and already selected
      const filtered = results.filter((user: any) => 
        user.id !== userId &&
        !tournament?.participants.some(p => p.userId === user.id)
      );
      setSearchResults(filtered);
    } catch (err: any) {
      console.error('Error searching:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, tournament, userId]);

  useEffect(() => {
    if (userId && id) {
      void loadData();
    }
  }, [id, loadData, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        void handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [handleSearch, searchQuery]);

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const handleSubmit = async () => {
    if (selectedUsers.size === 0) {
      setError('Please select at least one user to invite');
      return;
    }

    if (!tournament) return;

    setSubmitting(true);
    setError(null);

    try {
      await tournamentsService.inviteUsersToTournament(tournament.id, Array.from(selectedUsers));
      router.back();
    } catch (err: any) {
      console.error('Error sending invites:', err);
      setError(err.message || 'Failed to send invites');
    } finally {
      setSubmitting(false);
    }
  };

  const getAvailableFriends = () => {
    if (!tournament) return [];
    return friends.filter((f: any) => 
      !tournament.participants.some(p => p.userId === f.friend.id)
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Invite Players</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScreenLoader message="Loading..." />
      </View>
    );
  }

  const availableFriends = getAvailableFriends();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Invite Players</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
          {availableFriends.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{availableFriends.length}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Search
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'friends' ? (
          <>
            {availableFriends.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No Friends Available"
                subtitle="Add friends first or use search to find users"
              />
            ) : (
              <View style={styles.usersList}>
                {availableFriends.map((friendship: any) => (
                  <Pressable
                    key={friendship.friend.id}
                    style={[
                      styles.userCard,
                      selectedUsers.has(friendship.friend.id) && styles.userCardSelected,
                    ]}
                    onPress={() => toggleUser(friendship.friend.id)}
                  >
                    <UserAvatar
                      name={friendship.friend.displayName || friendship.friend.username}
                      avatarUrl={friendship.friend.avatar_url}
                      size={40}
                    />
                    <UserName
                      profile={{
                        id: friendship.friend.id,
                        displayName: friendship.friend.display_name,
                        username: friendship.friend.username,
                      }}
                      displayNameStyle={styles.userName}
                    />
                    {selectedUsers.has(friendship.friend.id) && (
                      <MaterialIcons name="check-circle" size={24} color={Colors.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by username..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isSearching && <LoadingSpinner size={16} />}
            </View>

            {searchQuery.trim().length === 0 ? (
              <View style={styles.searchHint}>
                <MaterialIcons name="search" size={48} color={Colors.textMuted} />
                <Text style={styles.searchHintText}>
                  Enter a username to search for users
                </Text>
              </View>
            ) : searchResults.length === 0 && !isSearching ? (
              <EmptyState
                icon="🔍"
                title="No Users Found"
                subtitle="Try a different username"
              />
            ) : (
              <View style={styles.usersList}>
                {searchResults.map((user: any) => (
                  <Pressable
                    key={user.id}
                    style={[
                      styles.userCard,
                      selectedUsers.has(user.id) && styles.userCardSelected,
                    ]}
                    onPress={() => toggleUser(user.id)}
                  >
                    <UserAvatar
                      name={user.display_name || user.username}
                      avatarUrl={user.avatar_url}
                      size={40}
                    />
                    <UserName
                      profile={{
                        id: user.id,
                        displayName: user.display_name,
                        username: user.username,
                      }}
                      displayNameStyle={styles.userName}
                    />
                    {selectedUsers.has(user.id) && (
                      <MaterialIcons name="check-circle" size={24} color={Colors.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        {selectedUsers.size > 0 && (
          <Text style={styles.selectedCount}>
            {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
          </Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Button
          title={submitting ? 'Sending Invites...' : `Send ${selectedUsers.size} Invite${selectedUsers.size !== 1 ? 's' : ''}`}
          onPress={handleSubmit}
          fullWidth
          disabled={submitting || selectedUsers.size === 0}
          icon={submitting ? <LoadingSpinner size={20} /> : undefined}
        />
      </View>
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
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  tabBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    paddingVertical: Spacing.xs,
  },
  searchHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  searchHintText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  usersList: {
    gap: Spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  userCardSelected: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  userName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  selectedCount: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});
