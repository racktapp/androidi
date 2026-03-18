import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { UserAvatar, UserName, LoadingSpinner, EmptyState } from '@/components';
import { getSupabaseClient } from '@/template';
import { preferencesService } from '@/services/preferences';

const supabase = getSupabaseClient();

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadBlockedUsers();
    }
  }, [userId]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadBlockedUsers = async () => {
    if (!userId) return;

    try {
      const data = await preferencesService.getBlockedUsers(userId);
      setBlockedUsers(data);
    } catch (err) {
      console.error('Error loading blocked users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    if (!userId) return;

    try {
      await preferencesService.unblockUser(userId, blockedUserId);
      showAlert('Success', 'User unblocked');
      loadBlockedUsers();
    } catch (err: any) {
      showAlert('Error', 'Failed to unblock user');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked Users</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={48} />
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
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {blockedUsers.length === 0 ? (
          <EmptyState
            icon="✓"
            title="No Blocked Users"
            subtitle="You haven't blocked anyone yet"
          />
        ) : (
          <View style={styles.list}>
            {blockedUsers.map((block) => (
              <View key={block.id} style={styles.userCard}>
                <UserAvatar
                  name={block.blockedUser.displayName || block.blockedUser.username}
                  avatarUrl={block.blockedUser.avatarUrl}
                  size={48}
                />
                <View style={styles.userInfo}>
                  <UserName
                    profile={block.blockedUser}
                    showHandle
                    displayNameStyle={styles.userName}
                  />
                </View>
                <Pressable
                  style={styles.unblockButton}
                  onPress={() => handleUnblock(block.blockedUserId)}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
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
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: Spacing.md,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  unblockButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
  },
  unblockText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
});
