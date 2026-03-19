import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export async function getPostAuthRoute(userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.username) {
    return '/onboarding';
  }

  const { data: ratings, error: ratingsError } = await supabase
    .from('user_ratings')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (ratingsError || !ratings || ratings.length === 0) {
    return '/onboarding';
  }

  return '/(tabs)/dashboard';
}
