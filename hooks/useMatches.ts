import { matchesService } from '@/services/matches';
import { Sport, MatchFormat, MatchType } from '@/constants/config';

export function useMatches() {
  const createMatch = async (data: {
    groupId?: string | null; // Optional for standalone 1v1 matches
    sport: Sport;
    format: MatchFormat;
    type: MatchType;
    createdBy: string;
    teamA: string[];
    teamB: string[];
    sets: Array<{ teamAScore: number; teamBScore: number; tiebreak?: string }>;
    winnerTeam: 'A' | 'B';
  }) => {
    const result = await matchesService.createMatch(data);
    return result.data;
  };

  const confirmMatch = async (matchId: string, userId: string) => {
    await matchesService.confirmMatch(matchId);
  };

  const getMatchById = async (matchId: string) => {
    return await matchesService.getMatchById(matchId);
  };

  const getGroupMatches = async (groupId: string, limit?: number) => {
    return await matchesService.getGroupMatches(groupId, limit);
  };

  const getUserMatches = async (userId: string, limit?: number) => {
    return await matchesService.getUserMatches(userId, limit);
  };

  return {
    createMatch,
    confirmMatch,
    getMatchById,
    getGroupMatches,
    getUserMatches,
  };
}
