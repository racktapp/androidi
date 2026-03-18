import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

async function invokeFunction(name: string, body: any) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  
  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        const parsed = textContent ? JSON.parse(textContent) : null;
        errorMessage = `[${statusCode}] ${parsed?.error || textContent || error.message}`;
      } catch {
        errorMessage = error.message || 'Function call failed';
      }
    }
    throw new Error(errorMessage);
  }
  
  return data;
}

export const friendsService = {
  async searchUsers(query: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, email, initials, avatar_url')
      .ilike('username', `%${query}%`)
      .limit(20);

    if (error) throw error;
    return data || [];
  },

  async sendFriendRequest(receiverId: string) {
    return await invokeFunction('send-friend-request', { receiverId });
  },

  async respondToRequest(requestId: string, accept: boolean) {
    return await invokeFunction('respond-friend-request', { requestId, accept });
  },

  async getIncomingRequests(userId: string) {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        status,
        created_at,
        sender:sender_id (id, username, display_name, email, initials, avatar_url)
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getOutgoingRequests(userId: string) {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        status,
        created_at,
        receiver:receiver_id (id, username, display_name, email, initials, avatar_url)
      `)
      .eq('sender_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getFriends(userId: string) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        created_at,
        friend:friend_id (id, username, display_name, email, initials, avatar_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
