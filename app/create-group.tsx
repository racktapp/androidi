import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Input, Button, Avatar, LoadingSpinner, UserAvatar } from '@/components';
import { Sport } from '@/constants/config';
import { useGroups } from '@/hooks/useGroups';
import { useFriends } from '@/hooks/useFriends';
import { Friendship } from '@/types';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export default function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createGroup } = useGroups();
  const { getFriends } = useFriends();

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sportFocus, setSportFocus] = useState<Sport | 'mixed'>('mixed');
  const [isPrivate, setIsPrivate] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadFriends();
    }
  }, [userId]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadFriends = async () => {
    if (!userId) return;
    try {
      const data = await getFriends(userId);
      setFriends(data);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    if (!userId) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createGroup({
        name: name.trim(),
        sportFocus,
        ownerId: userId,
        invitedFriendIds: selectedFriends,
      });

      if (!result?.group?.id) {
        throw new Error('No group ID returned - creation may have failed');
      }

      // Navigate to the new group
      router.replace(`/group/${result.group.id}`);
    } catch (err: any) {
      console.error('Create group error:', err);
      setError(err.message || 'Failed to create group. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Tennis Club, Weekend Warriors"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Sport Focus Segmented Control */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sport Focus</Text>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segment, sportFocus === 'tennis' && styles.segmentActive]}
              onPress={() => setSportFocus('tennis')}
            >
              <Image
                source={require('@/assets/icons/tennis_icon.png')}
                style={[styles.sportIcon, sportFocus !== 'tennis' && styles.sportIconInactive]}
                contentFit="contain"
                transition={0}
              />
              <Text style={[styles.segmentText, sportFocus === 'tennis' && styles.segmentTextActive]}>
                Tennis
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, sportFocus === 'padel' && styles.segmentActive]}
              onPress={() => setSportFocus('padel')}
            >
              <Image
                source={require('@/assets/icons/padel_icon.png')}
                style={[styles.sportIcon, sportFocus !== 'padel' && styles.sportIconInactive]}
                contentFit="contain"
                transition={0}
              />
              <Text style={[styles.segmentText, sportFocus === 'padel' && styles.segmentTextActive]}>
                Padel
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, sportFocus === 'mixed' && styles.segmentActive]}
              onPress={() => setSportFocus('mixed')}
            >
              <MaterialIcons 
                name="sports" 
                size={20} 
                color={sportFocus === 'mixed' ? Colors.textPrimary : Colors.textMuted} 
              />
              <Text style={[styles.segmentText, sportFocus === 'mixed' && styles.segmentTextActive]}>
                Both
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Privacy Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Private Group</Text>
              <Text style={styles.toggleHint}>Only invited members can join</Text>
            </View>
            <Pressable
              style={[styles.toggle, isPrivate && styles.toggleActive]}
              onPress={() => setIsPrivate(!isPrivate)}
            >
              <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbActive]} />
            </Pressable>
          </View>
        </View>

        {/* Invite Friends */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Invite Friends (Optional)</Text>
          {isLoadingFriends ? (
            <View style={styles.loadingContainer}>
              <LoadingSpinner size={24} />
              <Text style={styles.helperText}>Loading friends...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyFriendsCard}>
              <MaterialIcons name="people-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyFriendsText}>No friends to invite yet</Text>
              <Text style={styles.emptyFriendsHint}>Add friends to invite them to groups</Text>
            </View>
          ) : (
            <View style={styles.friendsList}>
              {friends.map(friendship => {
                const friendId = friendship.friend?.id || '';
                const isSelected = selectedFriends.includes(friendId);

                return (
                  <Pressable
                    key={friendship.id}
                    style={({ pressed }) => [
                      styles.friendCard,
                      isSelected && styles.friendCardSelected,
                      pressed && styles.friendCardPressed,
                    ]}
                    onPress={() => toggleFriend(friendId)}
                  >
                    <UserAvatar
                      name={friendship.friend?.displayName || friendship.friend?.username}
                      avatarUrl={friendship.friend?.avatarUrl}
                      size={44}
                    />
                    <Text style={styles.friendName}>
                      {friendship.friend?.displayName || friendship.friend?.username}
                    </Text>
                    <View style={[
                      styles.checkCircle,
                      isSelected && styles.checkCircleActive,
                    ]}>
                      {isSelected && (
                        <MaterialIcons name="check" size={16} color={Colors.textPrimary} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={20} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Create Button */}
      <View style={[styles.stickyButtonContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.createButtonPressed,
            submitting && styles.createButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <LoadingSpinner size={24} />
          ) : (
            <MaterialIcons name="add-circle" size={24} color={Colors.textPrimary} />
          )}
          <Text style={styles.createButtonText}>
            {submitting ? 'Creating...' : 'Create Group'}
          </Text>
        </Pressable>
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
  headerLogo: {
    width: 32,
    height: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  inputSection: {
    gap: Spacing.sm,
  },
  inputLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  segmentTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  sportIcon: {
    width: 18,
    height: 18,
  },
  sportIconInactive: {
    opacity: 0.5,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  toggleInfo: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  toggleHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.textPrimary,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  emptyFriendsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyFriendsText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  emptyFriendsHint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  friendsList: {
    gap: Spacing.sm,
  },
  friendCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  friendCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  friendCardPressed: {
    opacity: 0.7,
  },
  friendName: {
    flex: 1,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.danger + '15',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  errorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  createButton: {
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
  createButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
});
