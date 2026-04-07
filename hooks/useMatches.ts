import { useCallback, useMemo } from 'react';
import { matchesService } from '@/services/matches';
import { Sport, MatchFormat, MatchType } from '@/constants/config';

export function useMatches() {
  const createMatch = useCallback(async (data: {
    groupId?: string | null; // Optional for standalone 1v1 matches
    sport: Sport;
    format: MatchFormat;
    type: MatchType;
    createdBy: string;
    teamA: string[];
    teamB: string[];
    sets: { teamAScore: number; teamBScore: number; tiebreak?: string }[];
    winnerTeam: 'A' | 'B';
  }) => {
    const result = await matchesService.createMatch(data);
    return result.data;
  }, []);

  const confirmMatch = useCallback(async (matchId: string, _userId: string) => {
    await matchesService.confirmMatch(matchId);
  }, []);

  const getMatchById = useCallback(async (matchId: string) => {
    return await matchesService.getMatchById(matchId);
  }, []);

  const getGroupMatches = useCallback(async (groupId: string, limit?: number) => {
    return await matchesService.getGroupMatches(groupId, limit);
  }, []);

  const getUserMatches = useCallback(async (userId: string, limit?: number) => {
    return await matchesService.getUserMatches(userId, limit);
  }, []);

  return useMemo(() => ({
    createMatch,
    confirmMatch,
    getMatchById,
    getGroupMatches,
    getUserMatches,
  }), [confirmMatch, createMatch, getGroupMatches, getMatchById, getUserMatches]);
}
