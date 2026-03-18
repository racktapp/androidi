import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

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

    const { requestId, accept } = await req.json();

    if (!requestId || typeof accept !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Request ID and accept boolean are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the request
    const { data: request, error: requestError } = await supabaseClient
      .from('friend_requests')
      .select('*')
      .eq('id', requestId)
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      return new Response(JSON.stringify({ error: 'Friend request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (accept) {
      // Create mutual friendships
      const { error: friendship1Error } = await supabaseClient
        .from('friendships')
        .insert({
          user_id: request.sender_id,
          friend_id: request.receiver_id,
        });

      if (friendship1Error) {
        console.error('Error creating friendship 1:', friendship1Error);
        return new Response(JSON.stringify({ error: friendship1Error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: friendship2Error } = await supabaseClient
        .from('friendships')
        .insert({
          user_id: request.receiver_id,
          friend_id: request.sender_id,
        });

      if (friendship2Error) {
        console.error('Error creating friendship 2:', friendship2Error);
        return new Response(JSON.stringify({ error: friendship2Error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update request status
    const { error: updateError } = await supabaseClient
      .from('friend_requests')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
