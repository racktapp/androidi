import { getSupabaseClient } from '@/template';
import { Sport } from '@/constants/config';

const supabase = getSupabaseClient();

async function invokeFunction(name: string, body: any) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  
  if (error) {
    const errorMessage = error.message || 'Function call failed';
    throw new Error(errorMessage);
  }
  
  return data;
}

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
      userId: item.user.id,
      role: item.role,
      joinedAt: item.joined_at,
      user: item.user,
    }));
  },
};
