import { groupsService } from '@/services/groups';
import { Sport } from '@/constants/config';

export function useGroups() {
  const createGroup = async (data: {
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
  };

  const getUserGroups = async (userId: string) => {
    return await groupsService.getUserGroups(userId);
  };

  const getGroupById = async (groupId: string) => {
    return await groupsService.getGroupById(groupId);
  };

  const getGroupMembers = async (groupId: string) => {
    return await groupsService.getGroupMembers(groupId);
  };

  const addMember = async (groupId: string, userId: string) => {
    await groupsService.addGroupMembers(groupId, [userId]);
  };

  const addMembers = async (groupId: string, userIds: string[]) => {
    await groupsService.addGroupMembers(groupId, userIds);
  };

  const renameGroup = async (groupId: string, name: string) => {
    await groupsService.renameGroup(groupId, name);
  };

  const removeMember = async (memberId: string) => {
    await groupsService.removeMember(memberId);
  };

  const leaveGroup = async (groupId: string, userId: string) => {
    await groupsService.leaveGroup(groupId, userId);
  };

  const deleteGroup = async (groupId: string) => {
    await groupsService.deleteGroup(groupId);
  };

  return {
    createGroup,
    getUserGroups,
    getGroupById,
    getGroupMembers,
    addMember,
    addMembers,
    renameGroup,
    removeMember,
    leaveGroup,
    deleteGroup,
  };
}
