import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RatingUpdate {
  userId: string;
  sport: string;
  previousLevel: number;
  newLevel: number;
  previousReliability: number;
  newReliability: number;
}

// Elo-style rating calculation
// D = 1.2 (tuned for 0-7 scale)
// K-factor depends on reliability: lower reliability = bigger swings
function calculateEloChange(
  teamRating: number,
  opponentRating: number,
  reliability: number,
  won: boolean
): number {
  const D = 1.2;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - teamRating) / D));
  const actualScore = won ? 1 : 0;
  
  // K-factor: 0.08 to 0.25 based on reliability
  // Low reliability (0.2) → K ≈ 0.22
  // High reliability (0.8) → K ≈ 0.13
  const K = Math.max(0.08, Math.min(0.25, 0.25 - (reliability * 0.15)));
  
  return K * (actualScore - expectedScore);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let matchId = '';
  let userId = '';

  try {
    // Step 1: Authenticate user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('[Confirm Match] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ ok: false, error: 'You must be logged in to confirm matches' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    userId = user.id;
    console.log('[Confirm Match] User authenticated:', userId);

    // Step 2: Parse request body
    const body = await req.json();
    matchId = body.matchId;

    if (!matchId) {
      console.error('[Confirm Match] Missing matchId');
      return new Response(JSON.stringify({ ok: false, error: 'Match ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Confirm Match] Processing match:', matchId);

    // Step 3: Get match with players using service role to check rating_applied
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .select(`
        id,
        sport,
        format,
        type,
        status,
        winner_team,
        created_by,
        group_id,
        rating_applied,
        match_players(user_id, team)
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      console.error('[Confirm Match] Match not found:', matchError?.message);
      return new Response(JSON.stringify({ ok: false, error: 'Match not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Confirm Match] Match loaded:', {
      matchId: match.id,
      status: match.status,
      type: match.type,
      ratingApplied: match.rating_applied,
      createdBy: match.created_by,
      playerCount: match.match_players?.length,
    });

    // Step 4: Check if already confirmed (idempotent)
    if (match.status === 'confirmed' && match.rating_applied) {
      console.log('[Confirm Match] Match already confirmed and rating applied');
      return new Response(JSON.stringify({ 
        ok: true, 
        match_id: matchId, 
        status: 'confirmed',
        message: 'Match was already confirmed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (match.status === 'confirmed' && !match.rating_applied) {
      console.log('[Confirm Match] Match confirmed but rating not yet applied, will apply now');
    }

    if (match.status !== 'pending' && match.status !== 'confirmed') {
      console.error('[Confirm Match] Invalid match status:', match.status);
      return new Response(JSON.stringify({ ok: false, error: `Cannot confirm match with status: ${match.status}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 5: Determine user's side and creator's side
    const players = match.match_players as any[];
    
    if (!players || players.length === 0) {
      console.error('[Confirm Match] No players found for match');
      return new Response(JSON.stringify({ ok: false, error: 'Match has no players' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const confirmer = players.find((p: any) => p.user_id === userId);
    const creator = players.find((p: any) => p.user_id === match.created_by);

    if (!confirmer) {
      console.error('[Confirm Match] User is not a player in this match');
      return new Response(JSON.stringify({ ok: false, error: 'You are not listed as a player in this match' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!creator) {
      console.error('[Confirm Match] Creator not found in players');
      return new Response(JSON.stringify({ ok: false, error: 'Match creator not found in players list' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mySide = confirmer.team;
    const creatorSide = creator.team;

    console.log('[Confirm Match] Sides determined:', {
      userId,
      mySide,
      creatorId: match.created_by,
      creatorSide,
    });

    // Step 6: Enforce confirmation rules (only for pending matches)
    if (match.status === 'pending') {
      if (userId === match.created_by) {
        console.log('[Confirm Match] Creator cannot confirm own match');
        return new Response(JSON.stringify({ ok: false, error: 'You cannot confirm your own match. Wait for opponent confirmation.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (mySide === creatorSide) {
        console.log('[Confirm Match] Teammate cannot confirm');
        return new Response(JSON.stringify({ 
          ok: false, 
          error: match.format === 'singles' 
            ? 'Only your opponent can confirm the match'
            : 'Only players from the opposing team can confirm' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[Confirm Match] Validation passed, updating match status');

      // Update match status
      const { error: updateError } = await supabaseAdmin
        .from('matches')
        .update({
          status: 'confirmed',
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (updateError) {
        console.error('[Confirm Match] Database update failed:', updateError);
        return new Response(JSON.stringify({ 
          ok: false, 
          error: `Failed to confirm match: ${updateError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[Confirm Match] Match confirmed successfully');
    }

    // Step 7: Apply ratings if competitive AND not yet applied
    const ratingUpdates: RatingUpdate[] = [];

    if (match.type === 'competitive' && !match.rating_applied) {
      console.log('[Confirm Match] Applying competitive ratings (Elo-style)');

      const teamAPlayers = players.filter((p: any) => p.team === 'A');
      const teamBPlayers = players.filter((p: any) => p.team === 'B');

      // Get current ratings
      const allPlayerIds = players.map((p: any) => p.user_id);
      const { data: ratings } = await supabaseAdmin
        .from('user_ratings')
        .select('*')
        .in('user_id', allPlayerIds)
        .eq('sport', match.sport);

      const ratingsMap = new Map(ratings?.map((r: any) => [r.user_id, r]) || []);

      // Calculate team average ratings
      const teamARating = teamAPlayers.reduce((sum: number, p: any) => {
        const rating = ratingsMap.get(p.user_id);
        return sum + (rating?.level || 2.5);
      }, 0) / teamAPlayers.length;

      const teamBRating = teamBPlayers.reduce((sum: number, p: any) => {
        const rating = ratingsMap.get(p.user_id);
        return sum + (rating?.level || 2.5);
      }, 0) / teamBPlayers.length;

      console.log('[Confirm Match] Team ratings:', {
        teamA: teamARating.toFixed(2),
        teamB: teamBRating.toFixed(2),
      });

      // Update each player's rating
      for (const player of players) {
        const currentRating = ratingsMap.get(player.user_id);
        const currentLevel = currentRating?.level || 2.5;
        const currentReliability = currentRating?.reliability || 0.2;
        const matchesPlayed = currentRating?.matches_played || 0;

        const won = player.team === match.winner_team;
        const playerTeamRating = player.team === 'A' ? teamARating : teamBRating;
        const opponentTeamRating = player.team === 'A' ? teamBRating : teamARating;

        const ratingDelta = calculateEloChange(
          playerTeamRating,
          opponentTeamRating,
          currentReliability,
          won
        );

        const newLevel = Math.max(0, Math.min(7, currentLevel + ratingDelta));
        const newReliability = Math.min(1.0, currentReliability + 0.05); // +5% per match

        console.log('[Confirm Match] Player rating update:', {
          userId: player.user_id,
          won,
          currentLevel: currentLevel.toFixed(2),
          delta: ratingDelta.toFixed(2),
          newLevel: newLevel.toFixed(2),
          reliability: `${(currentReliability * 100).toFixed(0)}% → ${(newReliability * 100).toFixed(0)}%`,
        });

        // Update user_ratings
        await supabaseAdmin
          .from('user_ratings')
          .upsert({
            user_id: player.user_id,
            sport: match.sport,
            level: Number(newLevel.toFixed(1)),
            reliability: Number(newReliability.toFixed(2)),
            matches_played: matchesPlayed + 1,
            updated_at: new Date().toISOString(),
          });

        // Record history
        await supabaseAdmin.from('rating_history').insert({
          user_id: player.user_id,
          match_id: matchId,
          sport: match.sport,
          previous_level: Number(currentLevel.toFixed(1)),
          new_level: Number(newLevel.toFixed(1)),
          previous_reliability: Number(currentReliability.toFixed(2)),
          new_reliability: Number(newReliability.toFixed(2)),
        });

        ratingUpdates.push({
          userId: player.user_id,
          sport: match.sport,
          previousLevel: Number(currentLevel.toFixed(1)),
          newLevel: Number(newLevel.toFixed(1)),
          previousReliability: Number(currentReliability.toFixed(2)),
          newReliability: Number(newReliability.toFixed(2)),
        });
      }

      // Mark rating as applied
      await supabaseAdmin
        .from('matches')
        .update({ rating_applied: true })
        .eq('id', matchId);

      console.log('[Confirm Match] Ratings updated and marked as applied for', ratingUpdates.length, 'players');
    } else if (match.type !== 'competitive') {
      console.log('[Confirm Match] Skipping rating update (friendly match)');
      // Mark as "applied" even for friendly (no rating changes, but flag set)
      await supabaseAdmin
        .from('matches')
        .update({ rating_applied: true })
        .eq('id', matchId);
    } else {
      console.log('[Confirm Match] Rating already applied, skipping');
    }

    // Step 8: Create feed event (only for group matches)
    if (match.group_id) {
      // Check if feed event already exists for this match confirmation
      const { data: existingFeed } = await supabaseAdmin
        .from('feed_events')
        .select('id')
        .eq('event_type', 'match_confirmed')
        .eq('match_id', matchId)
        .single();

      if (!existingFeed) {
        const { error: feedError } = await supabaseAdmin.from('feed_events').insert({
          event_type: 'match_confirmed',
          group_id: match.group_id,
          match_id: matchId,
          metadata: { confirmed_by: userId },
        });

        if (feedError) {
          console.error('[Confirm Match] Error creating feed event:', feedError);
        } else {
          console.log('[Confirm Match] Feed event created for group:', match.group_id);
        }
      } else {
        console.log('[Confirm Match] Feed event already exists, skipping');
      }
    } else {
      console.log('[Confirm Match] Standalone match - skipping feed event');
    }

    console.log('[Confirm Match] Complete - returning success');

    return new Response(JSON.stringify({ 
      ok: true, 
      match_id: matchId, 
      status: 'confirmed',
      ratingUpdates,
      message: match.type === 'competitive' 
        ? `Ratings updated for ${ratingUpdates.length} players`
        : 'Match confirmed (friendly - no rating changes)'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Confirm Match] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      matchId,
      userId,
    });

    return new Response(JSON.stringify({ 
      ok: false, 
      error: error.message || 'An unexpected error occurred while confirming the match' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
