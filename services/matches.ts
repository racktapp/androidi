import { getSupabaseClient } from '@/template';
import { Sport, MatchFormat, MatchType } from '@/constants/config';

const supabase = getSupabaseClient();

async function invokeFunction(name: string, body: any) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  
  if (error) {
    // Handle FunctionsHttpError to get detailed error message
    let errorMessage = error.message || 'Function call failed';
    
    if (error.context) {
      try {
        const responseText = await error.context.text();
        const responseData = JSON.parse(responseText);
        
        // Use the specific error message from the function if available
        if (responseData.error) {
          errorMessage = responseData.error;
        }
      } catch (parseErr) {
        // If we can't parse, keep the original error message
        console.error('Could not parse error response:', parseErr);
      }
    }
    
    throw new Error(errorMessage);
  }
  
  // Check if function returned an error in data (ok: false pattern)
  if (data && data.ok === false && data.error) {
    throw new Error(data.error);
  }
  
  return data;
}

export const matchesService = {
  async createMatch(data: {
    groupId?: string | null; // Now optional for standalone 1v1 matches
    sport: Sport;
    format: MatchFormat;
    type: MatchType;
    teamA: string[];
    teamB: string[];
    sets: Array<{ teamAScore: number; teamBScore: number; tiebreak?: string }>;
    winnerTeam: 'A' | 'B';
  }) {
    return await invokeFunction('create-match', {
      groupId: data.groupId || null,
      sport: data.sport,
      format: data.format,
      type: data.type,
      teamA: data.teamA,
      teamB: data.teamB,
      sets: data.sets,
      winnerTeam: data.winnerTeam,
    });
  },

  async confirmMatch(matchId: string) {
    return await invokeFunction('confirm-match', { matchId });
  },

  async getMatchById(matchId: string) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        players:match_players(
          id,
          user_id,
          team,
          user:user_id (id, username, display_name, email, initials, avatar_url)
        ),
        sets:match_sets(
          id,
          set_number,
          team_a_score,
          team_b_score,
          tiebreak
        ),
        group:group_id (id, name)
      `)
      .eq('id', matchId)
      .single();

    if (error) throw error;

    // Map database fields to camelCase and ensure userId is always present
    const mappedPlayers = (data.players || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id, // Explicitly map user_id to userId
      team: p.team,
      user: p.user,
    }));

    return {
      id: data.id,
      groupId: data.group_id,
      sport: data.sport,
      format: data.format,
      type: data.type,
      status: data.status,
      winnerTeam: data.winner_team,
      createdBy: data.created_by,
      confirmedBy: data.confirmed_by,
      createdAt: data.created_at,
      confirmedAt: data.confirmed_at,
      group: data.group,
      players: mappedPlayers,
      sets: data.sets.sort((a: any, b: any) => a.set_number - b.set_number),
    };
  },

  async getGroupMatches(groupId: string, limit = 10) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        players:match_players(
          id,
          user_id,
          team,
          user:user_id (id, username, display_name, email, initials, avatar_url)
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((match: any) => ({
      id: match.id,
      groupId: match.group_id,
      sport: match.sport,
      format: match.format,
      type: match.type,
      status: match.status,
      winnerTeam: match.winner_team,
      createdBy: match.created_by,
      confirmedBy: match.confirmed_by,
      createdAt: match.created_at,
      confirmedAt: match.confirmed_at,
      players: (match.players || []).map((player: any) => ({
        id: player.id,
        userId: player.user_id,
        team: player.team,
        user: player.user
          ? {
              id: player.user.id,
              username: player.user.username,
              displayName: player.user.display_name || player.user.displayName || player.user.username,
              display_name: player.user.display_name,
              email: player.user.email,
              initials: player.user.initials,
              avatarUrl: player.user.avatar_url,
              avatar_url: player.user.avatar_url,
            }
          : null,
      })),
    }));
  },

  async getUserMatches(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('match_players')
      .select(`
        match:match_id (
          id,
          sport,
          format,
          type,
          status,
          winner_team,
          created_at,
          group:group_id (id, name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item: any) => item.match);
  },

  async getLeaderboard(groupId: string, sport: Sport, period: 'monthly' | 'alltime') {
    // Get group members
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, user:user_id(id, username, display_name, email, initials, avatar_url)')
      .eq('group_id', groupId);

    if (!members) return [];

    const userIds = members.map((m: any) => m.user_id);

    // Get ratings
    const { data: ratings } = await supabase
      .from('user_ratings')
      .select('*')
      .in('user_id', userIds)
      .eq('sport', sport);

    const ratingsMap = new Map(ratings?.map(r => [r.user_id, r]) || []);

    // Build leaderboard
    const leaderboard = await Promise.all(
      members.map(async (member: any) => {
        const rating = ratingsMap.get(member.user_id);
        
        // Get match stats
        let query = supabase
          .from('match_players')
          .select('match_id, team, match:match_id(id, winner_team, status, sport, group_id, created_at)')
          .eq('user_id', member.user_id);

        const { data: playerMatches } = await query;

        const matches = (playerMatches || [])
          .filter((pm: any) => 
            pm.match.status === 'confirmed' &&
            pm.match.sport === sport &&
            pm.match.group_id === groupId
          )
          .filter((pm: any) => {
            if (period === 'monthly') {
              const now = new Date();
              const matchDate = new Date(pm.match.created_at);
              return matchDate.getMonth() === now.getMonth() &&
                     matchDate.getFullYear() === now.getFullYear();
            }
            return true;
          });

        const wins = matches.filter((pm: any) => pm.team === pm.match.winner_team).length;
        const losses = matches.length - wins;

        return {
          userId: member.user_id,
          user: member.user,
          level: rating?.level || 0,
          reliability: rating?.reliability || 0,
          wins,
          losses,
          winPercentage: matches.length > 0 ? (wins / matches.length) * 100 : 0,
        };
      })
    );

    // Sort and rank (by wins, then level as tiebreaker)
    leaderboard.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.level - a.level;
    });

    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  },
};
