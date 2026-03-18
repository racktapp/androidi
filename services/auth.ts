import { getSupabaseClient } from '@/template';
import { Sport } from '@/constants/config';

const supabase = getSupabaseClient();

export interface CreateAccountData {
  username: string;
  displayName: string;
  sports: Sport[];
  levels: Record<Sport, number>;
}

export const authService = {
  async createAccount(data: CreateAccountData) {
    // Create auth user with email/password
    const email = `${data.username}@rackt.app`;
    const password = `temp_${Date.now()}_${Math.random()}`;
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: data.username,
          display_name: data.displayName,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // Create user ratings for selected sports
    const ratingInserts = data.sports.map(sport => ({
      user_id: authData.user!.id,
      sport,
      level: data.levels[sport],
      reliability: 0.20,
      matches_played: 0,
    }));

    const { error: ratingsError } = await supabase
      .from('user_ratings')
      .insert(ratingInserts);

    if (ratingsError) {
      console.error('Error creating ratings:', ratingsError);
    }

    return authData.user;
  },

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
