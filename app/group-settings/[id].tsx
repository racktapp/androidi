import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { getSupabaseClient, useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsRow, SettingsSection } from '@/components/settings';
import { Button, UserAvatar } from '@/components';
import { useGroups } from '@/hooks/useGroups';
import { useFriends } from '@/hooks/useFriends';
import { GroupMember } from '@/types';
import { getUserLabel } from '@/utils/getUserLabel';

const supabase = getSupabaseClient();

type ConfirmAction = 'leave' | 'delete' | 'remove-member' | null;
type MemberRole = 'owner' | 'admin' | 'member';

const normalizeMemberRole = (role: unknown): MemberRole => {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }

  return 'member';
};

export default function GroupSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const groupId = useMemo(() => {
    if (Array.isArray(id)) {
      const firstValidId = id.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
      return firstValidId?.trim();
    }

    if (typeof id === 'string' && id.trim().length > 0) {
      return id.trim();
    }

    return undefined;
  }, [id]);
  const { showAlert } = useAlert();
  const groupsHook = useGroups();
  const friendsHook = useFriends();

  const [userId, setUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<any | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUpdatingRoles, setIsUpdatingRoles] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  const buildInviteCode = (value: string) => value.replace(/-/g, '').slice(0, 8).toUpperCase();

  const loadData = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      showAlert('Invalid group link', 'Unable to open settings because the group id is missing.');
      router.back();
      return;
    }

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id || null;
      setUserId(currentUserId);

      const [groupData, membersData] = await Promise.all([
        groupsHook.getGroupById(groupId),
        groupsHook.getGroupMembers(groupId),
      ]);

      if (!groupData) {
        throw new Error('Group not found');
      }

      setGroup(groupData);
      setMembers(membersData);
      setNewGroupName(groupData.name);
      setInviteCode(groupData.inviteCode || buildInviteCode(groupData.id));

      if (currentUserId) {
        const friendsData = await friendsHook.getFriends(currentUserId);
        setFriends(friendsData || []);
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to load group settings');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [friendsHook, groupId, groupsHook, router, showAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentMember = members.find(member => member.userId === userId);
  const currentRole = normalizeMemberRole(currentMember?.role);
  const canManageGroup = currentRole === 'owner' || currentRole === 'admin';
  const isOwner = currentRole === 'owner';

  const addableFriends = useMemo(() => {
    const memberIds = new Set(members.map(member => member.userId));
    return (friends || []).filter((friendship: any) => {
      const friend = friendship.friend;
      return friend?.id && !memberIds.has(friend.id);
    });
  }, [friends, members]);

  const getInviteLink = () => {
    if (!groupId) return '';
    return `rackt://group/${groupId}?code=${inviteCode}`;
  };

  const handleRenameGroup = async () => {
    if (!groupId || !canManageGroup || !newGroupName.trim()) return;

    const trimmed = newGroupName.trim();
    if (trimmed === group?.name) return;

    setSaving(true);
    try {
      await groupsHook.renameGroup(groupId, trimmed);
      setGroup((prev: any) => (prev ? { ...prev, name: trimmed } : prev));
      showAlert('Success', 'Group renamed successfully');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to rename group');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    if (!groupId || !canManageGroup) return;

    try {
      await groupsHook.addMember(groupId, friendId);
      showAlert('Success', 'Member added');
      await loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to add member');
    }
  };

  const handleCopyInviteCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    showAlert('Copied', 'Invite code copied to clipboard');
  };

  const handleCopyInviteLink = async () => {
    await Clipboard.setStringAsync(getInviteLink());
    showAlert('Copied', 'Invite link copied to clipboard');
  };

  const handleRegenerateInviteCode = async () => {
    if (!canManageGroup || !groupId) return;

    const regenerated = Math.random().toString(36).slice(2, 10).toUpperCase();
    try {
      await groupsHook.updateInviteCode(groupId, regenerated);
      setInviteCode(regenerated);
      showAlert('Invite Code Updated', 'Share the new code with members you trust.');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to regenerate invite code');
    }
  };

  const handleUpdateMemberRole = async (member: GroupMember, role: 'admin' | 'member') => {
    if (!isOwner || member.userId === userId) return;

    setIsUpdatingRoles(true);
    setActiveMemberId(member.id);
    try {
      await groupsHook.updateMemberRole(member.id, role);
      showAlert('Updated', `Member role updated to ${role}.`);
      await loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update member role');
    } finally {
      setActiveMemberId(null);
      setIsUpdatingRoles(false);
    }
  };

  const handleTransferOwnership = async (member: GroupMember) => {
    if (!groupId || !userId || !isOwner || member.userId === userId) return;

    setIsUpdatingRoles(true);
    setActiveMemberId(member.id);
    try {
      await groupsHook.transferOwnership(groupId, member.userId, userId);
      showAlert('Ownership Transferred', 'You are now an admin of this group.');
      await loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to transfer ownership');
    } finally {
      setActiveMemberId(null);
      setIsUpdatingRoles(false);
    }
  };

  const requestRemoveMember = (member: GroupMember) => {
    setSelectedMember(member);
    setConfirmAction('remove-member');
  };

  const confirmRemoveMember = async () => {
    if (!selectedMember) return;

    try {
      await groupsHook.removeMember(selectedMember.id);
      showAlert('Removed', 'Member removed from group');
      setSelectedMember(null);
      setConfirmAction(null);
      await loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to remove member');
    }
  };

  const confirmLeaveGroup = async () => {
    if (!groupId || !userId) return;

    try {
      await groupsHook.leaveGroup(groupId, userId);
      showAlert('Left Group', 'You are no longer a member of this group');
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to leave group');
    }
  };

  const confirmDeleteGroup = async () => {
    if (!groupId || !canManageGroup) return;

    try {
      await groupsHook.deleteGroup(groupId);
      showAlert('Deleted', 'Group deleted successfully');
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to delete group');
    }
  };

  if (loading || !group) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Group Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
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
        <Text style={styles.headerTitle}>Group Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Group">
          <View style={styles.renameContainer}>
            <Text style={styles.fieldLabel}>Group name</Text>
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              editable={canManageGroup && !saving}
              placeholder="Enter group name"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, !canManageGroup && styles.inputDisabled]}
            />
            {canManageGroup ? (
              <Button
                title={saving ? 'Saving...' : 'Rename Group'}
                onPress={handleRenameGroup}
                disabled={saving || !newGroupName.trim()}
              />
            ) : (
              <Text style={styles.helperText}>Only owners and admins can rename the group.</Text>
            )}
          </View>
        </SettingsSection>

        <SettingsSection title="Members">
          {members.map(member => {
            const label = getUserLabel(member.user);
            const role = normalizeMemberRole(member.role);
            const isCurrentUser = member.userId === userId;
            const memberKey = member.id || `${member.userId}-${member.joinedAt || 'member'}`;

            return (
              <View key={memberKey} style={styles.memberRow}>
                <UserAvatar
                  name={label.displayName}
                  avatarUrl={member.user?.avatarUrl}
                  size={40}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{label.displayName}</Text>
                  <Text style={styles.memberMeta}>
                    {role.toUpperCase()}
                    {isCurrentUser ? ' · You' : ''}
                  </Text>
                </View>

                {!isCurrentUser && canManageGroup ? (
                  <View style={styles.memberActions}>
                    {isOwner && (
                      <>
                        <Pressable
                          onPress={() => handleUpdateMemberRole(member, role === 'admin' ? 'member' : 'admin')}
                          style={styles.memberActionChip}
                          disabled={isUpdatingRoles}
                        >
                          <Text style={styles.memberActionText}>
                            {role === 'admin' ? 'Remove admin' : 'Make admin'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleTransferOwnership(member)}
                          style={styles.memberActionChip}
                          disabled={isUpdatingRoles}
                        >
                          <Text style={styles.memberActionText}>Make owner</Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable onPress={() => requestRemoveMember(member)} style={styles.removeChip}>
                      <Text style={styles.removeChipText}>Remove</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}

          {isUpdatingRoles && activeMemberId ? (
            <Text style={styles.helperText}>Updating member permissions…</Text>
          ) : null}

          {canManageGroup && addableFriends.length > 0 && (
            <View style={styles.addMembersBox}>
              <Text style={styles.addMembersTitle}>Add members</Text>
              {addableFriends.slice(0, 6).map((friendship: any) => {
                const friend = friendship.friend;
                const label = getUserLabel(friend);

                return (
                  <Pressable
                    key={friend.id}
                    style={styles.addFriendRow}
                    onPress={() => handleAddFriend(friend.id)}
                  >
                    <View style={styles.addFriendInfo}>
                      <UserAvatar
                        name={label.displayName}
                        avatarUrl={friend.avatar_url}
                        size={34}
                      />
                      <View>
                        <Text style={styles.addFriendName}>{label.displayName}</Text>
                        <Text style={styles.addFriendHandle}>{label.handle}</Text>
                      </View>
                    </View>
                    <MaterialIcons name="person-add" size={20} color={Colors.primary} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </SettingsSection>

        <SettingsSection title="Invite">
          <View style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>Invite code</Text>
            <Text style={styles.inviteCode}>{inviteCode}</Text>

            <View style={styles.inviteActions}>
              <View style={styles.inviteActionButton}>
                <Button title="Copy Code" onPress={handleCopyInviteCode} variant="secondary" />
              </View>
              <View style={styles.inviteActionButton}>
                <Button title="Copy Link" onPress={handleCopyInviteLink} variant="secondary" />
              </View>
            </View>

            {canManageGroup ? (
              <Pressable style={styles.regenerateButton} onPress={handleRegenerateInviteCode}>
                <MaterialIcons name="autorenew" size={16} color={Colors.primary} />
                <Text style={styles.regenerateText}>Regenerate code</Text>
              </Pressable>
            ) : (
              <Text style={styles.helperText}>Only owners and admins can manage invite codes.</Text>
            )}
          </View>
        </SettingsSection>

        <SettingsSection title="Membership">
          <SettingsRow
            icon="logout"
            title="Leave Group"
            subtitle="You can rejoin if invited again"
            onPress={() => setConfirmAction('leave')}
            showChevron={false}
          />
        </SettingsSection>

        {canManageGroup && (
          <View style={styles.dangerSection}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <Pressable style={styles.deleteButton} onPress={() => setConfirmAction('delete')}>
              <MaterialIcons name="delete-forever" size={20} color={Colors.danger} />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </Pressable>
            <Text style={styles.dangerHint}>This will permanently remove the group and all related data.</Text>
          </View>
        )}
      </ScrollView>

      {confirmAction && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialIcons
              name={confirmAction === 'delete' ? 'warning' : 'help-outline'}
              size={44}
              color={confirmAction === 'delete' ? Colors.danger : Colors.primary}
            />
            <Text style={styles.modalTitle}>
              {confirmAction === 'leave' && 'Leave group?'}
              {confirmAction === 'delete' && 'Delete group?'}
              {confirmAction === 'remove-member' && 'Remove member?'}
            </Text>
            <Text style={styles.modalMessage}>
              {confirmAction === 'leave' && 'You will lose access to group matches and updates until someone invites you back.'}
              {confirmAction === 'delete' && 'This action is permanent and cannot be undone.'}
              {confirmAction === 'remove-member' && 'This member will no longer have access to this group.'}
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setConfirmAction(null)}>
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, confirmAction === 'delete' ? styles.modalButtonDanger : styles.modalButtonPrimary]}
                onPress={() => {
                  if (confirmAction === 'leave') {
                    confirmLeaveGroup();
                  } else if (confirmAction === 'delete') {
                    confirmDeleteGroup();
                  } else {
                    confirmRemoveMember();
                  }
                }}
              >
                <Text style={styles.modalButtonConfirmText}>
                  {confirmAction === 'delete' ? 'Delete' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  renameContainer: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.base,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
  memberMeta: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
  removeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  removeChipText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  memberActions: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  memberActionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  memberActionText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  addMembersBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  addMembersTitle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.sm,
    fontWeight: Typography.weights.medium,
  },
  addFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  addFriendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addFriendName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  addFriendHandle: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
  inviteCard: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  inviteLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  inviteCode: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    letterSpacing: 2,
    fontWeight: Typography.weights.bold,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inviteActionButton: {
    flex: 1,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  regenerateText: {
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
    fontSize: Typography.sizes.sm,
  },
  dangerSection: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  dangerTitle: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: Typography.weights.semibold,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  deleteButtonText: {
    color: Colors.danger,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
  },
  dangerHint: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
  },
  modalMessage: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.surfaceElevated,
  },
  modalButtonCancelText: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.medium,
  },
  modalButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  modalButtonDanger: {
    backgroundColor: Colors.danger,
  },
  modalButtonConfirmText: {
    color: '#FFF',
    fontWeight: Typography.weights.semibold,
  },
});
