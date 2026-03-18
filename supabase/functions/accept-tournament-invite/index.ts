import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      console.error('[accept-invite] No authorization token provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user JWT to verify identity
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[accept-invite] User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[accept-invite] User authenticated: ${user.id}`);

    // Create service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { inviteId, accept } = await req.json();
    
    if (!inviteId || typeof accept !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: inviteId, accept' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[accept-invite] Processing: inviteId=${inviteId}, accept=${accept}, userId=${user.id}`);

    // STEP 1: Get and validate invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('tournament_invites')
      .select('id, tournament_id, invited_user_id, status')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      console.error('[accept-invite] Invite not found:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Invite not found or has been deleted' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate permissions
    if (invite.invited_user_id !== user.id) {
      console.error('[accept-invite] Permission denied: invite user mismatch');
      return new Response(
        JSON.stringify({ error: 'You are not authorized to respond to this invite' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invite.status !== 'pending') {
      console.error(`[accept-invite] Invite already ${invite.status}`);
      return new Response(
        JSON.stringify({ error: `This invite has already been ${invite.status}` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: Get tournament
    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id, state, participants, created_by_user_id, title, deleted_at')
      .eq('id', invite.tournament_id)
      .single();

    if (tournamentError || !tournament) {
      console.error('[accept-invite] Tournament not found:', tournamentError);
      
      // Mark invite as expired
      await supabaseAdmin
        .from('tournament_invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
      
      return new Response(
        JSON.stringify({ error: 'This tournament no longer exists or has been deleted' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[accept-invite] Tournament found:', tournament.title);

    // Check if deleted
    if (tournament.deleted_at) {
      await supabaseAdmin
        .from('tournament_invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
      
      return new Response(
        JSON.stringify({ error: 'This tournament has been deleted' }), 
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tournament.state === 'completed') {
      return new Response(
        JSON.stringify({ error: 'This tournament has already completed' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = accept ? 'accepted' : 'declined';

    if (accept) {
      // STEP 3: Get user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('[accept-invite] Profile fetch failed:', profileError);
        return new Response(
          JSON.stringify({ error: 'Failed to load your profile' }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newParticipant = {
        userId: user.id,
        displayName: profile.display_name || profile.username || 'Unknown',
        username: profile.username || '',
        avatarUrl: profile.avatar_url || null,
        joinedAt: new Date().toISOString(),
        seed: null,
      };

      // STEP 4: Check if already participant (idempotency)
      const alreadyParticipant = tournament.participants?.some(
        (p: any) => p.userId === user.id
      );

      if (!alreadyParticipant) {
        // STEP 5: Add participant using service role (bypasses RLS)
        const updatedParticipants = [...(tournament.participants || []), newParticipant];

        console.log(`[accept-invite] Adding participant (service role): ${updatedParticipants.length} total`);

        const { error: updateError } = await supabaseAdmin
          .from('tournaments')
          .update({ 
            participants: updatedParticipants,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invite.tournament_id);

        if (updateError) {
          console.error('[accept-invite] Failed to add participant:', updateError);
          return new Response(
            JSON.stringify({ error: `Failed to join tournament: ${updateError.message}` }), 
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[accept-invite] Participant added successfully');
      } else {
        console.log('[accept-invite] User already participant (idempotent)');
      }

      // STEP 6: Update invite status
      const { error: inviteUpdateError } = await supabaseAdmin
        .from('tournament_invites')
        .update({ status: newStatus })
        .eq('id', inviteId);

      if (inviteUpdateError) {
        console.error('[accept-invite] Failed to update invite status:', inviteUpdateError);
        // Non-critical - user is already added
      }

      console.log('[accept-invite] SUCCESS - User joined tournament');

      return new Response(
        JSON.stringify({ 
          ok: true, 
          tournamentId: invite.tournament_id, 
          joined: true,
          participantRecordFound: true,
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Declining invite
      const { error: inviteUpdateError } = await supabaseAdmin
        .from('tournament_invites')
        .update({ status: newStatus })
        .eq('id', inviteId);

      if (inviteUpdateError) {
        console.error('[accept-invite] Failed to decline invite:', inviteUpdateError);
        return new Response(
          JSON.stringify({ error: 'Failed to decline invite' }), 
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[accept-invite] Invite declined');

      return new Response(
        JSON.stringify({ ok: true, joined: false }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[accept-invite] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
