import { getSupabaseClient } from '@/template';
import { Sport } from '@/constants/config';

const supabase = getSupabaseClient();
const buildDefaultInviteCode = (groupId: string) => groupId.replace(/-/g, '').slice(0, 8).toUpperCase();

export const groupsService = {
  async createGroup(data: {
    name: string;
    sportFocus: Sport | 'mixed';
    invitedFriendIds: string[];
  }) {
    // Use atomic RPC function instead of Edge Function
    const { data: group, error } = await supabase.rpc('create_group_atomic', {
      p_name: data.name,
      p_sport_focus: data.sportFocus,
      p_invited_friend_ids: data.invitedFriendIds,
    });

    if (error) {
      console.error('Create group error:', error);
      throw new Error(error.message || 'Failed to create group');
    }

    if (!group) {
      throw new Error('No group returned from database');
    }

    return { data: group };
  },

  async getUserGroups(userId: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group:group_id (
          id,
          name,
          sport_focus,
          owner_id,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;
    
    // Extract groups and add member count
    const groups = await Promise.all(
      (data || []).map(async (item: any) => {
        const group = item.group;
        
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id);

        return {
          id: group.id,
          name: group.name,
          sportFocus: group.sport_focus,
          ownerId: group.owner_id,
          memberCount: count || 0,
          createdAt: group.created_at,
        };
      })
    );

    return groups;
  },

  async getGroupById(groupId: string) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) throw error;

    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    return {
      id: data.id,
      name: data.name,
      sportFocus: data.sport_focus,
      ownerId: data.owner_id,
      inviteCode: data.invite_code || buildDefaultInviteCode(data.id),
      memberCount: count || 0,
      createdAt: data.created_at,
    };
  },

  async getGroupMembers(groupId: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        id,
        role,
        joined_at,
        user:user_id (id, username, display_name, email, initials, avatar_url)
      `)
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      groupId,
      userId: item.user.id,
      role: item.role,
      joinedAt: item.joined_at,
      user: item.user,
    }));
  },

  async renameGroup(groupId: string, name: string) {
    const { error } = await supabase
      .from('groups')
      .update({ name })
      .eq('id', groupId);

    if (error) throw error;
  },

  async updateMemberRole(memberId: string, role: 'admin' | 'member') {
    const { error } = await supabase
      .from('group_members')
      .update({ role })
      .eq('id', memberId);

    if (error) throw error;
  },

  async transferOwnership(groupId: string, nextOwnerUserId: string, currentOwnerUserId: string) {
    const { error: ownerUpdateError } = await supabase
      .from('groups')
      .update({ owner_id: nextOwnerUserId })
      .eq('id', groupId);

    if (ownerUpdateError) throw ownerUpdateError;

    const { error: promoteError } = await supabase
      .from('group_members')
      .update({ role: 'owner' })
      .eq('group_id', groupId)
      .eq('user_id', nextOwnerUserId);

    if (promoteError) throw promoteError;

    const { error: demoteError } = await supabase
      .from('group_members')
      .update({ role: 'admin' })
      .eq('group_id', groupId)
      .eq('user_id', currentOwnerUserId);

    if (demoteError) throw demoteError;
  },

  async updateInviteCode(groupId: string, inviteCode: string) {
    const { error } = await supabase
      .from('groups')
      .update({ invite_code: inviteCode })
      .eq('id', groupId);

    if (error) throw error;
  },

  async addGroupMembers(groupId: string, userIds: string[]) {
    if (userIds.length === 0) return;

    const { data: existingMembers, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .in('user_id', userIds);

    if (membersError) throw membersError;

    const existingUserIds = new Set((existingMembers || []).map((m: any) => m.user_id));
    const newRows = userIds
      .filter(userId => !existingUserIds.has(userId))
      .map(userId => ({
        group_id: groupId,
        user_id: userId,
        role: 'member',
      }));

    if (newRows.length === 0) return;

    const { error } = await supabase.from('group_members').insert(newRows);
    if (error) throw error;
  },

  async removeMember(memberId: string) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  },

  async leaveGroup(groupId: string, userId: string) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteGroup(groupId: string) {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) throw error;
  },
};
