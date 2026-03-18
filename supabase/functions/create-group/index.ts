import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Client for auth verification (with user context)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Admin client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { name, sportFocus, invitedFriendIds } = await req.json();

    if (!name || !sportFocus) {
      return new Response(JSON.stringify({ error: 'Name and sport focus are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use admin client for all database operations (atomic transaction)
    // Create group
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({
        name,
        sport_focus: sportFocus,
        owner_id: user.id,
      })
      .select()
      .single();

    if (groupError) {
      console.error('Error creating group:', groupError);
      return new Response(JSON.stringify({ error: groupError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add owner as member
    const { error: ownerMemberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
      });

    if (ownerMemberError) {
      console.error('Error adding owner as member:', ownerMemberError);
      // Cleanup: delete group
      await supabaseAdmin.from('groups').delete().eq('id', group.id);
      return new Response(JSON.stringify({ error: ownerMemberError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add invited friends as members
    if (invitedFriendIds && invitedFriendIds.length > 0) {
      const memberInserts = invitedFriendIds.map((friendId: string) => ({
        group_id: group.id,
        user_id: friendId,
        role: 'member',
      }));

      const { error: membersError } = await supabaseAdmin
        .from('group_members')
        .insert(memberInserts);

      if (membersError) {
        console.error('Error adding invited members:', membersError);
        // Continue anyway - group is created with owner
      }

      // Create feed events for invited friends
      const feedEvents = invitedFriendIds.map((friendId: string) => ({
        event_type: 'group_joined',
        user_id: friendId,
        group_id: group.id,
        metadata: { invited_by: user.id, group_name: group.name },
      }));

      const { error: feedEventsError } = await supabaseAdmin.from('feed_events').insert(feedEvents);
      
      if (feedEventsError) {
        console.error('[Create Group] Error creating group_joined feed events:', feedEventsError);
      } else {
        console.log('[Create Group] Created group_joined events for', invitedFriendIds.length, 'friends');
      }
    }

    // Create feed event for group creation
    const { error: feedError } = await supabaseAdmin.from('feed_events').insert({
      event_type: 'group_created',
      user_id: user.id,
      group_id: group.id,
      metadata: { group_name: group.name },
    });

    if (feedError) {
      console.error('[Create Group] Error creating group_created feed event:', feedError);
    } else {
      console.log('[Create Group] Created group_created feed event for group:', group.id);
    }

    return new Response(JSON.stringify({ data: group }), {
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
