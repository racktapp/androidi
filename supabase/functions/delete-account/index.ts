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

    const { confirmation } = await req.json();

    if (confirmation !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'Invalid confirmation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for deletions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Delete friendships (cascades via RLS)
    await supabaseAdmin
      .from('friendships')
      .delete()
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    // Delete friend requests
    await supabaseAdmin
      .from('friend_requests')
      .delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    // Remove from group memberships (but keep groups)
    await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('user_id', user.id);

    // Anonymize user profile but keep for match history integrity
    await supabaseAdmin
      .from('user_profiles')
      .update({
        username: `deleted_user_${user.id.substring(0, 8)}`,
        display_name: 'Deleted User',
        email: `deleted_${user.id}@rackt.deleted`,
      })
      .eq('id', user.id);

    // Delete auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(JSON.stringify({ error: deleteAuthError.message }), {
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
