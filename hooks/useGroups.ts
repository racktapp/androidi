import { useCallback, useMemo } from 'react';
import { groupsService } from '@/services/groups';
import { Sport } from '@/constants/config';

export function useGroups() {
  const createGroup = useCallback(async (data: {
    name: string;
    sportFocus: Sport | 'mixed';
    ownerId: string;
    invitedFriendIds: string[];
  }) => {
    const result = await groupsService.createGroup({
      name: data.name,
      sportFocus: data.sportFocus,
      invitedFriendIds: data.invitedFriendIds,
    });

    return { group: result.data };
  }, []);

  const getUserGroups = useCallback(async (userId: string) => {
    return await groupsService.getUserGroups(userId);
  }, []);

  const getGroupById = useCallback(async (groupId: string) => {
    return await groupsService.getGroupById(groupId);
  }, []);

  const getGroupMembers = useCallback(async (groupId: string) => {
    return await groupsService.getGroupMembers(groupId);
  }, []);

  const addMember = useCallback(async (groupId: string, userId: string) => {
    await groupsService.addGroupMembers(groupId, [userId]);
  }, []);

  const addMembers = useCallback(async (groupId: string, userIds: string[]) => {
    await groupsService.addGroupMembers(groupId, userIds);
  }, []);

  const renameGroup = useCallback(async (groupId: string, name: string) => {
    await groupsService.renameGroup(groupId, name);
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    await groupsService.removeMember(memberId);
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: 'admin' | 'member') => {
    await groupsService.updateMemberRole(memberId, role);
  }, []);

  const transferOwnership = useCallback(async (groupId: string, nextOwnerUserId: string, currentOwnerUserId: string) => {
    await groupsService.transferOwnership(groupId, nextOwnerUserId, currentOwnerUserId);
  }, []);

  const updateInviteCode = useCallback(async (groupId: string, inviteCode: string) => {
    await groupsService.updateInviteCode(groupId, inviteCode);
  }, []);

  const leaveGroup = useCallback(async (groupId: string, userId: string) => {
    await groupsService.leaveGroup(groupId, userId);
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
    await groupsService.deleteGroup(groupId);
  }, []);

  return useMemo(() => ({
    createGroup,
    getUserGroups,
    getGroupById,
    getGroupMembers,
    addMember,
    addMembers,
    renameGroup,
    removeMember,
    updateMemberRole,
    transferOwnership,
    updateInviteCode,
    leaveGroup,
    deleteGroup,
  }), [
    addMember,
    addMembers,
    createGroup,
    deleteGroup,
    getGroupById,
    getGroupMembers,
    getUserGroups,
    leaveGroup,
    removeMember,
    renameGroup,
    transferOwnership,
    updateInviteCode,
    updateMemberRole,
  ]);
}
