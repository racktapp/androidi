/**
 * Get user display label and handle from profile data
 * 
 * This is the single source of truth for rendering user names across the app.
 * Always use this helper to ensure consistent fallback logic.
 */

interface UserProfile {
  displayName?: string | null;
  display_name?: string | null;
  name?: string | null;
  username?: string | null;
  handle?: string | null;
}

export interface UserLabel {
  /** Primary display name (never empty, uses fallbacks) */
  displayName: string;
  /** Handle with @ prefix (empty if no handle available) */
  handle: string;
}

/**
 * Extract display name and handle from user profile
 * @param profile - User profile object (supports both camelCase and snake_case)
 * @returns { displayName, handle } with proper fallbacks
 */
export function getUserLabel(profile?: UserProfile | null): UserLabel {
  if (!profile) {
    return {
      displayName: 'Unknown',
      handle: '',
    };
  }

  // Try display_name (snake_case), displayName (camelCase), name, username
  const displayName = 
    profile.display_name || 
    profile.displayName || 
    profile.name || 
    profile.username || 
    profile.handle || 
    'Unknown';

  // Try username or handle for @handle
  const rawHandle = profile.username || profile.handle || '';
  const handle = rawHandle ? `@${rawHandle}` : '';

  return {
    displayName,
    handle,
  };
}
