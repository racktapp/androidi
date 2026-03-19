/**
 * Match score normalization utilities
 * Ensures consistent score format across all match displays
 */

export interface NormalizedSet {
  a: number;
  b: number;
  tiebreak?: string;
}

/**
 * Normalize match sets from any storage format to canonical display format
 * Handles snake_case database fields and ensures valid numeric scores
 * 
 * @param match - Raw match object with sets data
 * @returns Array of normalized sets with a/b scores, or empty array if no valid sets
 */
export function normalizeMatchSets(match: any): NormalizedSet[] {
  const rawSets = Array.isArray(match?.sets)
    ? match.sets
    : Array.isArray(match?.match_sets)
      ? match.match_sets
      : [];

  if (rawSets.length === 0) {
    return [];
  }

  return rawSets
    .filter((set: any) => {
      // Must have valid numeric scores
      const aScore = set.team_a_score ?? set.teamAScore ?? set.a;
      const bScore = set.team_b_score ?? set.teamBScore ?? set.b;
      
      return (
        typeof aScore === 'number' &&
        typeof bScore === 'number' &&
        !isNaN(aScore) &&
        !isNaN(bScore)
      );
    })
    .map((set: any) => {
      // Support multiple field name formats
      const a = set.team_a_score ?? set.teamAScore ?? set.a;
      const b = set.team_b_score ?? set.teamBScore ?? set.b;
      const tiebreak = set.tiebreak;

      return {
        a: Number(a),
        b: Number(b),
        ...(tiebreak && { tiebreak }),
      };
    });
}

/**
 * Calculate sets won by each team from normalized sets
 */
export function calculateSetsWon(sets: NormalizedSet[]): { setsWonA: number; setsWonB: number } {
  const setsWonA = sets.filter(s => s.a > s.b).length;
  const setsWonB = sets.filter(s => s.b > s.a).length;
  
  return { setsWonA, setsWonB };
}

/**
 * Determine match winner from sets
 */
export function determineWinner(sets: NormalizedSet[]): 'A' | 'B' | null {
  const { setsWonA, setsWonB } = calculateSetsWon(sets);
  
  if (setsWonA > setsWonB) return 'A';
  if (setsWonB > setsWonA) return 'B';
  return null;
}
