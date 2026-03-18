import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, UserAvatar, UserName, ScreenLoader, EmptyState, ErrorState } from '@/components';
import { useFriends } from '@/hooks/useFriends';
import { User, FriendRequest, Friendship } from '@/types';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { 
    searchUsers, 
    sendFriendRequest, 
    respondToRequest, 
    getIncomingRequests, 
    getOutgoingRequests, 
    getFriends 
  } = useFriends();

  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, tab]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadData = async () => {
    if (!userId) return;
    try {
      setError(null);
      if (tab === 'friends') {
        const data = await getFriends(userId);
        setFriends(data);
      } else if (tab === 'requests') {
        const incoming = await getIncomingRequests(userId);
        const outgoing = await getOutgoingRequests(userId);
        setIncomingRequests(incoming);
        setOutgoingRequests(outgoing);
      }
    } catch (err: any) {
      console.error('Error loading friends data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoadingInitial(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [userId, tab]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const results = await searchUsers(searchQuery);
    // Filter out self and existing friends
    const friendIds = friends.map(f => f.friend?.id);
    const filtered = results.filter(u => u.id !== userId && !friendIds.includes(u.id));
    setSearchResults(filtered);
  };

  const handleSendRequest = async (receiverId: string) => {
    if (!userId) return;

    try {
      await sendFriendRequest(userId, receiverId);
      showAlert('Success', 'Friend request sent');
      handleSearch(); // Refresh results
    } catch (err: any) {
      showAlert('Error', err.message);
    }
  };

  const handleAccept = async (requestId: string) => {
    if (!userId) return;

    try {
      await respondToRequest(requestId, userId, true);
      showAlert('Success', 'Friend request accepted');
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!userId) return;

    try {
      await respondToRequest(requestId, userId, false);
      showAlert('Success', 'Friend request rejected');
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message);
    }
  };

  const renderFriends = () => (
    <View style={styles.listContainer}>
      {friends.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No Friends Yet"
          subtitle="Search for friends by username to get started"
        />
      ) : (
        friends.map(friendship => (
          <View key={friendship.id} style={styles.friendCard}>
            <UserAvatar
              name={friendship.friend?.displayName || friendship.friend?.username}
              avatarUrl={friendship.friend?.avatarUrl}
              size={48}
            />
            <View style={styles.friendInfo}>
              <UserName
                profile={friendship.friend}
                showHandle
                displayNameStyle={styles.friendName}
                handleStyle={styles.friendUsername}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderSearch = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by username..."
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={handleSearch}
        />
        <Pressable onPress={handleSearch}>
          <MaterialIcons name="search" size={24} color={Colors.textMuted} />
        </Pressable>
      </View>

      {searchResults.length > 0 && (
        <View style={styles.listContainer}>
          {searchResults.map(user => (
            <View key={user.id} style={styles.friendCard}>
              <UserAvatar
                name={user.displayName || user.username}
                avatarUrl={user.avatarUrl}
                size={48}
              />
              <View style={styles.friendInfo}>
                <UserName
                  profile={user}
                  showHandle
                  displayNameStyle={styles.friendName}
                  handleStyle={styles.friendUsername}
                />
              </View>
              <Button
                title="Add"
                size="small"
                onPress={() => handleSendRequest(user.id)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderRequests = () => (
    <View style={styles.listContainer}>
      {incomingRequests.length > 0 && (
        <>
          <Text style={styles.subsectionTitle}>Incoming Requests</Text>
          {incomingRequests.map(request => (
            <View key={request.id} style={styles.requestCard}>
              <UserAvatar
                name={request.sender?.displayName || request.sender?.username}
                avatarUrl={request.sender?.avatarUrl}
                size={48}
              />
              <View style={styles.friendInfo}>
                <UserName
                  profile={request.sender}
                  showHandle
                  displayNameStyle={styles.friendName}
                  handleStyle={styles.friendUsername}
                />
              </View>
              <View style={styles.requestActions}>
                <Pressable
                  style={styles.acceptButton}
                  onPress={() => handleAccept(request.id)}
                >
                  <MaterialIcons name="check" size={20} color={Colors.textPrimary} />
                </Pressable>
                <Pressable
                  style={styles.rejectButton}
                  onPress={() => handleReject(request.id)}
                >
                  <MaterialIcons name="close" size={20} color={Colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      {outgoingRequests.length > 0 && (
        <>
          <Text style={styles.subsectionTitle}>Outgoing Requests</Text>
          {outgoingRequests.map(request => (
            <View key={request.id} style={styles.friendCard}>
              <UserAvatar
                name={request.receiver?.displayName || request.receiver?.username}
                avatarUrl={request.receiver?.avatarUrl}
                size={48}
              />
              <View style={styles.friendInfo}>
                <UserName
                  profile={request.receiver}
                  showHandle
                  displayNameStyle={styles.friendName}
                  handleStyle={styles.friendUsername}
                />
              </View>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          ))}
        </>
      )}

      {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
        <EmptyState
          icon="📭"
          title="No Pending Requests"
        />
      )}
    </View>
  );

  if (isLoadingInitial && tab !== 'search') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === 'friends' && styles.tabActive]}
            onPress={() => setTab('friends')}
          >
            <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'search' && styles.tabActive]}
            onPress={() => setTab('search')}
          >
            <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>
              Search
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'requests' && styles.tabActive]}
            onPress={() => setTab('requests')}
          >
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
          </Pressable>
        </View>
        <ScreenLoader message="Loading..." />
      </View>
    );
  }

  if (error && tab !== 'search') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === 'friends' && styles.tabActive]}
            onPress={() => setTab('friends')}
          >
            <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
              Friends
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'search' && styles.tabActive]}
            onPress={() => setTab('search')}
          >
            <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>
              Search
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'requests' && styles.tabActive]}
            onPress={() => setTab('requests')}
          >
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
              Requests
            </Text>
          </Pressable>
        </View>
        <ErrorState message={error} onRetry={loadData} />
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Friends</Text>
        <Pressable onPress={() => router.push('/settings')}>
          <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'friends' && styles.tabActive]}
          onPress={() => setTab('friends')}
        >
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'search' && styles.tabActive]}
          onPress={() => setTab('search')}
        >
          <Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>
            Search
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'requests' && styles.tabActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            Requests
            {incomingRequests.length > 0 && (
              <Text style={styles.badge}> {incomingRequests.length}</Text>
            )}
          </Text>
        </Pressable>
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
        {tab === 'friends' && renderFriends()}
        {tab === 'search' && renderSearch()}
        {tab === 'requests' && renderRequests()}
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
  badge: {
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  searchContainer: {
    gap: Spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  listContainer: {
    gap: Spacing.md,
  },
  subsectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  friendCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  friendInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  friendName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  friendUsername: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  acceptButton: {
    backgroundColor: Colors.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: Colors.danger,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
