import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export interface UserPreferences {
  id: string;
  userId: string;
  notifyMatchConfirmations: boolean;
  notifyFriendRequests: boolean;
  notifyGroupActivity: boolean;
  notifyWeeklySummary: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
  whoCanAdd: 'everyone' | 'friends_of_friends' | 'nobody';
  themePreference: 'system' | 'dark' | 'light';
  createdAt: string;
  updatedAt: string;
}

export const preferencesService = {
  async getPreferences(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If no preferences exist, create default ones
      if (error.code === 'PGRST116') {
        return await this.createDefaultPreferences(userId);
      }
      throw error;
    }

    return this.mapFromDb(data);
  },

  async createDefaultPreferences(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from('user_preferences')
      .insert({
        user_id: userId,
        notify_match_confirmations: true,
        notify_friend_requests: true,
        notify_group_activity: true,
        notify_weekly_summary: true,
        profile_visibility: 'friends',
        who_can_add: 'everyone',
        theme_preference: 'system',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapFromDb(data);
  },

  async updatePreferences(
    userId: string,
    updates: Partial<Omit<UserPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<UserPreferences> {
    const dbUpdates: any = {};

    if (updates.notifyMatchConfirmations !== undefined) {
      dbUpdates.notify_match_confirmations = updates.notifyMatchConfirmations;
    }
    if (updates.notifyFriendRequests !== undefined) {
      dbUpdates.notify_friend_requests = updates.notifyFriendRequests;
    }
    if (updates.notifyGroupActivity !== undefined) {
      dbUpdates.notify_group_activity = updates.notifyGroupActivity;
    }
    if (updates.notifyWeeklySummary !== undefined) {
      dbUpdates.notify_weekly_summary = updates.notifyWeeklySummary;
    }
    if (updates.profileVisibility !== undefined) {
      dbUpdates.profile_visibility = updates.profileVisibility;
    }
    if (updates.whoCanAdd !== undefined) {
      dbUpdates.who_can_add = updates.whoCanAdd;
    }
    if (updates.themePreference !== undefined) {
      dbUpdates.theme_preference = updates.themePreference;
    }

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_preferences')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return this.mapFromDb(data);
  },

  async getBlockedUsers(userId: string) {
    const { data, error } = await supabase
      .from('blocked_users')
      .select(`
        id,
        blocked_user_id,
        created_at,
        blocked_user:blocked_user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((block: any) => ({
      id: block.id,
      blockedUserId: block.blocked_user_id,
      createdAt: block.created_at,
      blockedUser: {
        id: block.blocked_user.id,
        username: block.blocked_user.username,
        displayName: block.blocked_user.display_name,
        avatarUrl: block.blocked_user.avatar_url,
      },
    }));
  },

  async blockUser(userId: string, blockedUserId: string) {
    const { error } = await supabase
      .from('blocked_users')
      .insert({
        user_id: userId,
        blocked_user_id: blockedUserId,
      });

    if (error) throw error;
  },

  async unblockUser(userId: string, blockedUserId: string) {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('user_id', userId)
      .eq('blocked_user_id', blockedUserId);

    if (error) throw error;
  },

  mapFromDb(data: any): UserPreferences {
    return {
      id: data.id,
      userId: data.user_id,
      notifyMatchConfirmations: data.notify_match_confirmations,
      notifyFriendRequests: data.notify_friend_requests,
      notifyGroupActivity: data.notify_group_activity,
      notifyWeeklySummary: data.notify_weekly_summary,
      profileVisibility: data.profile_visibility,
      whoCanAdd: data.who_can_add,
      themePreference: data.theme_preference,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
};
