import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Client for auth verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { groupId, sport, format, type, teamA, teamB, sets, winnerTeam } = await req.json();

    // groupId is now optional for standalone 1v1 matches
    if (!sport || !format || !type || !teamA || !teamB || !sets || !winnerTeam) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If groupId is provided, verify user is member
    if (groupId) {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return new Response(JSON.stringify({ error: 'Not a member of this group' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create match (group_id can be null for standalone matches)
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .insert({
        group_id: groupId || null,
        sport,
        format,
        type,
        status: 'pending',
        winner_team: winnerTeam,
        created_by: user.id,
      })
      .select()
      .single();

    if (matchError) {
      console.error('Error creating match:', matchError);
      return new Response(JSON.stringify({ error: matchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add players
    const playerInserts = [
      ...teamA.map((userId: string) => ({
        match_id: match.id,
        user_id: userId,
        team: 'A',
      })),
      ...teamB.map((userId: string) => ({
        match_id: match.id,
        user_id: userId,
        team: 'B',
      })),
    ];

    const { error: playersError } = await supabaseAdmin
      .from('match_players')
      .insert(playerInserts);

    if (playersError) {
      console.error('Error adding players:', playersError);
      await supabaseAdmin.from('matches').delete().eq('id', match.id);
      return new Response(JSON.stringify({ error: playersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add sets
    const setInserts = sets.map((set: any, index: number) => ({
      match_id: match.id,
      set_number: index + 1,
      team_a_score: set.teamAScore,
      team_b_score: set.teamBScore,
      tiebreak: set.tiebreak || null,
    }));

    const { error: setsError } = await supabaseAdmin
      .from('match_sets')
      .insert(setInserts);

    if (setsError) {
      console.error('Error adding sets:', setsError);
      await supabaseAdmin.from('matches').delete().eq('id', match.id);
      return new Response(JSON.stringify({ error: setsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: match }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
