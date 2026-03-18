import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

/**
 * Convert avatar_url from database to a displayable URL
 * Handles both public URLs and storage paths
 * @param avatarUrl - The avatar_url field from user_profiles table
 * @returns Displayable URL or null
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;

  // If it's already a full URL (http/https), return as is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }

  // If it's a storage path (e.g., "avatars/user-id/filename.jpg"), convert to public URL
  if (avatarUrl.startsWith('avatars/')) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
    return data.publicUrl;
  }

  // Fallback: assume it's a path and try to get public URL
  try {
    const { data } = supabase.storage.from('avatars').getPublicUrl(avatarUrl);
    return data.publicUrl;
  } catch {
    return null;
  }
}

/**
 * Generate initials from user name
 * @param displayName - User's display name
 * @param username - User's username (fallback)
 * @returns Two-letter initials in uppercase
 */
export function generateInitials(
  displayName?: string | null,
  username?: string | null
): string {
  // Use display name if available
  if (displayName && displayName.trim()) {
    const words = displayName.trim().split(/\s+/);
    if (words.length >= 2) {
      // First letter of first two words
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    // First two letters of display name
    return displayName.slice(0, 2).toUpperCase();
  }

  // Fall back to username
  if (username && username.trim()) {
    return username.slice(0, 2).toUpperCase();
  }

  // Ultimate fallback
  return '??';
}
