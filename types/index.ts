import { Sport, MatchType, MatchFormat } from '@/constants/config';

export interface User {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  avatar?: string;
  sports: Sport[];
  createdAt: string;
}

export interface UserRating {
  id: string;
  userId: string;
  sport: Sport;
  rating: number; // Internal rating (Elo-like)
  level: number; // Display level 0.0-7.0
  reliability: number; // 0.0-1.0
  matchesPlayed: number;
  updatedAt: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  sender?: User;
  receiver?: User;
}

export interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
  friend?: User;
}

export interface Group {
  id: string;
  name: string;
  sportFocus: Sport | 'mixed';
  ownerId: string;
  createdAt: string;
  memberCount?: number;
  owner?: User;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  user?: User;
}

export interface Match {
  id: string;
  groupId: string;
  sport: Sport;
  format: MatchFormat;
  type: MatchType;
  status: 'pending' | 'confirmed';
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
  group?: Group;
  players?: MatchPlayer[];
  sets?: MatchSet[];
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  userId: string;
  team: 'A' | 'B';
  isWinner: boolean;
  ratingBefore?: number;
  ratingAfter?: number;
  levelBefore?: number;
  levelAfter?: number;
  reliabilityBefore?: number;
  reliabilityAfter?: number;
  user?: User;
}

export interface MatchSet {
  id: string;
  matchId: string;
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
  tiebreak?: string; // e.g., "(5)" for 7-6(5)
}

export interface FeedEvent {
  id: string;
  type: 'match_confirmed' | 'group_created' | 'user_joined_group';
  userId: string;
  matchId?: string;
  groupId?: string;
  createdAt: string;
  user?: User;
  match?: Match;
  group?: Group;
}

export interface LeaderboardEntry {
  userId: string;
  user?: User;
  level: number;
  reliability: number;
  wins: number;
  losses: number;
  winPercentage: number;
  rank: number;
}

export interface TournamentParticipant {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  joinedAt: string;
  seed?: number | null;
}

export interface Tournament {
  id: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  sport: Sport;
  type: 'americano' | 'normal';
  format?: 'groups_playoffs';
  mode: 'singles' | 'doubles';
  isCompetitive: boolean;
  state: 'draft' | 'inviting' | 'locked' | 'in_progress' | 'completed' | 'deleted';
  groupId: string | null;
  participants: TournamentParticipant[];
  settings: {
    courts?: number;
    americano?: {
      pointsToWin?: number;
      rounds?: number;
    };
    groupsPlayoffs?: {
      groupCount?: number;
      advancePerGroup?: number;
    };
  };
}

export interface TournamentInvite {
  id: string;
  tournamentId: string;
  invitedUserId: string;
  invitedByUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  invitedUser?: User;
  invitedByUser?: User;
}

export interface TournamentTeam {
  memberUserIds: string[];
  members?: TournamentParticipant[];
}

export interface TournamentGroup {
  id: string;
  tournamentId: string;
  name: string;
  groupIndex: number;
  participants: TournamentParticipant[];
  createdAt: string;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  stage: 'group' | 'playoff';
  groupId: string | null;
  roundIndex: number;
  teamA: TournamentTeam;
  teamB: TournamentTeam;
  score: Array<{ a: number; b: number }>;
  status: 'pending' | 'submitted' | 'confirmed';
  submittedByUserId: string | null;
  confirmedByUserIds: string[];
  winner: 'A' | 'B' | null;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentStanding {
  participant: TournamentParticipant;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
}

export interface AmericanoRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  matches: TournamentMatch[];
  createdAt: string;
}

export interface AmericanoLeaderboardEntry {
  participant: TournamentParticipant;
  totalPointsFor: number;
  totalPointsAgainst: number;
  pointDiff: number;
  matchesPlayed: number;
  rank: number;
}

export interface AmericanoPairLeaderboardEntry {
  pairKey: string;
  participants: [TournamentParticipant, TournamentParticipant];
  totalPointsFor: number;
  totalPointsAgainst: number;
  pointDiff: number;
  matchesPlayed: number;
  rank: number;
}
