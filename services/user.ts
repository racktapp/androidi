import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

async function invokeFunction(name: string, body: any) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  
  if (error) {
    const errorMessage = error.message || 'Function call failed';
    throw new Error(errorMessage);
  }
  
  return data;
}

export const userService = {
  async getUserById(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      email: data.email,
      initials: data.initials,
      avatarUrl: data.avatar_url,
    };
  },

  async getUserRatings(userId: string) {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map((r: any) => ({
      id: r.id,
      sport: r.sport,
      level: r.level,
      reliability: r.reliability,
      matchesPlayed: r.matches_played,
    }));
  },

  async deleteAccount(confirmation: string) {
    return await invokeFunction('delete-account', { confirmation });
  },

  async getFeed(userId: string, limit = 20) {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    const groupIds = (memberships || []).map((m: any) => m.group_id);

    if (groupIds.length === 0) {
      return [];
    }

    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId);

    const friendIds = (friendships || []).map((f: any) => f.friend_id);

    let filterQuery = `group_id.in.(${groupIds.join(',')})`;
    if (friendIds.length > 0) {
      filterQuery += `,user_id.in.(${friendIds.join(',')})`;
    }

    const { data, error } = await supabase
      .from('feed_events')
      .select(`
        id,
        event_type,
        created_at,
        group_id,
        metadata,
        user:user_id (id, username, display_name, initials, avatar_url),
        group:group_id (id, name),
        match:match_id (
          id,
          sport,
          format,
          winner_team,
          players:match_players(user:user_id(id, username, display_name, initials, avatar_url), team)
        )
      `)
      .or(filterQuery)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Feed Service] Error loading feed:', error);
      throw error;
    }

    const eventsWithMissingGroups = (data || []).filter(
      (event: any) => event.group_id && !event.group?.name
    );

    if (eventsWithMissingGroups.length > 0) {
      console.warn('[Feed Service] Events missing group names:', 
        eventsWithMissingGroups.map((e: any) => ({
          eventId: e.id,
          eventType: e.event_type,
          groupId: e.group_id,
        }))
      );
    }

    return data || [];
  },
};
