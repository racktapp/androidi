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
    // This would need a new edge function - placeholder for now
    throw new Error('Not implemented');
  };

  return {
    createGroup,
    getUserGroups,
    getGroupById,
    getGroupMembers,
    addMember,
  };
}
