/**
 * mapUserIdentity - Single source of truth for normalizing user data
 * 
 * This utility ensures consistent user field mapping across the entire app.
 * Use this before rendering any user identity UI (avatar, name, etc.)
 * 
 * Handles both camelCase and snake_case field variations from different sources:
 * - Database queries (snake_case)
 * - Service responses (camelCase)
 * - API responses (mixed)
 */

export interface UserIdentity {
  /** User ID */
  id: string;
  /** Display name (never empty, uses fallbacks) */
  displayName: string;
  /** Username without @ prefix */
  username: string;
  /** Avatar URL (can be storage path or full URL) */
  avatarUrl: string | null;
  /** Two-letter initials for fallback */
  initials: string;
}

/**
 * Normalize user data from any source into consistent UserIdentity format
 * @param user - Raw user object from database/API/service
 * @returns Normalized UserIdentity with all required fields
 */
export function mapUserIdentity(user: any): UserIdentity {
  if (!user) {
    console.warn('[mapUserIdentity] Received null/undefined user, using fallback');
    return {
      id: '',
      displayName: 'Unknown',
      username: '',
      avatarUrl: null,
      initials: '??',
    };
  }

  // Extract ID (try multiple field names)
  const id = user.id || user.user_id || user.userId || '';

  // Extract display name (try multiple field names, use fallbacks)
  const displayName = 
    user.display_name || 
    user.displayName || 
    user.name ||
    user.username ||
    user.handle ||
    'Unknown';

  // Extract username (try multiple field names)
  const username = 
    user.username || 
    user.handle ||
    user.display_name?.toLowerCase() ||
    user.displayName?.toLowerCase() ||
    '';

  // Extract avatar URL (try multiple field names)
  const avatarUrl = 
    user.avatar_url || 
    user.avatarUrl || 
    user.avatar ||
    user.photoURL ||
    user.profileImage ||
    null;

  // Generate initials from display name
  const initials = generateInitialsFromName(displayName);

  return {
    id,
    displayName,
    username,
    avatarUrl,
    initials,
  };
}

/**
 * Generate two-letter initials from a name
 * @param name - Display name or username
 * @returns Two uppercase letters
 */
function generateInitialsFromName(name: string): string {
  if (!name || !name.trim()) {
    return '??';
  }

  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);

  // If multiple words, use first letter of first two words
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // If single word with 2+ chars, use first two letters
  if (trimmed.length >= 2) {
    return trimmed.slice(0, 2).toUpperCase();
  }

  // If single char, duplicate it
  if (trimmed.length === 1) {
    return (trimmed[0] + trimmed[0]).toUpperCase();
  }

  return '??';
}

/**
 * Batch map multiple users at once
 * @param users - Array of raw user objects
 * @returns Array of normalized UserIdentity objects
 */
export function mapUsersIdentity(users: any[]): UserIdentity[] {
  if (!users || !Array.isArray(users)) {
    return [];
  }

  return users.map(mapUserIdentity);
}
