import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export interface UserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  initials: string;
}

// In-memory cache
const profileCache = new Map<string, UserProfile>();
const pendingRequests = new Map<string, Promise<UserProfile | null>>();

function generateInitials(profile: { displayName?: string | null; username?: string | null }): string {
  const name = (profile.displayName || profile.username || 'RA').trim();
  
  // Take first 2 letters
  const letters = name
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return letters.length === 2 ? letters : (name.slice(0, 2).toUpperCase() || 'RA');
}

export const profilesCache = {
  /**
   * Get a single profile by ID
   * Uses cache if available, otherwise fetches from database
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    // Check cache first
    if (profileCache.has(userId)) {
      return profileCache.get(userId)!;
    }

    // Check if already fetching
    if (pendingRequests.has(userId)) {
      return pendingRequests.get(userId)!;
    }

    // Fetch from database
    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, initials')
          .eq('id', userId)
          .single();

        if (error || !data) {
          console.warn(`[ProfilesCache] Failed to fetch profile for ${userId}:`, error?.message);
          return null;
        }

        const profile: UserProfile = {
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          avatarUrl: data.avatar_url,
          initials: data.initials || generateInitials({ displayName: data.display_name, username: data.username }),
        };

        profileCache.set(userId, profile);
        return profile;
      } catch (err) {
        console.error('[ProfilesCache] Error fetching profile:', err);
        return null;
      } finally {
        pendingRequests.delete(userId);
      }
    })();

    pendingRequests.set(userId, fetchPromise);
    return fetchPromise;
  },

  /**
   * Get multiple profiles by IDs
   * Uses cache for known profiles, batch-fetches unknown ones
   */
  async getProfiles(userIds: string[]): Promise<Record<string, UserProfile>> {
    const results: Record<string, UserProfile> = {};
    const unknownIds: string[] = [];

    // Separate cached vs unknown
    for (const id of userIds) {
      if (profileCache.has(id)) {
        results[id] = profileCache.get(id)!;
      } else {
        unknownIds.push(id);
      }
    }

    // Batch fetch unknown profiles
    if (unknownIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, initials')
          .in('id', unknownIds);

        if (error) {
          console.warn('[ProfilesCache] Failed to batch fetch profiles:', error.message);
        } else if (data) {
          for (const row of data) {
            const profile: UserProfile = {
              id: row.id,
              username: row.username,
              displayName: row.display_name,
              avatarUrl: row.avatar_url,
              initials: row.initials || generateInitials({ displayName: row.display_name, username: row.username }),
            };

            profileCache.set(row.id, profile);
            results[row.id] = profile;
          }
        }
      } catch (err) {
        console.error('[ProfilesCache] Error batch fetching profiles:', err);
      }
    }

    return results;
  },

  /**
   * Manually set a profile in cache (use after user profile updates)
   */
  setProfile(userId: string, profile: UserProfile) {
    profileCache.set(userId, profile);
  },

  /**
   * Clear cache for a specific user (use after profile updates)
   */
  clearProfile(userId: string) {
    profileCache.delete(userId);
    pendingRequests.delete(userId);
  },

  /**
   * Clear entire cache
   */
  clearAll() {
    profileCache.clear();
    pendingRequests.clear();
  },
};
