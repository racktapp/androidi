// Mock data service for V1 (will be replaced with OnSpace Cloud)
import { 
  User, 
  UserRating, 
  FriendRequest, 
  Friendship, 
  Group, 
  GroupMember, 
  Match, 
  MatchPlayer, 
  MatchSet,
  FeedEvent 
} from '@/types';
import { Sport, MatchType, MatchFormat } from '@/constants/config';
import { Config } from '@/constants/config';

// In-memory storage
let users: User[] = [];
let userRatings: UserRating[] = [];
let friendRequests: FriendRequest[] = [];
let friendships: Friendship[] = [];
let groups: Group[] = [];
let groupMembers: GroupMember[] = [];
let matches: Match[] = [];
let matchPlayers: MatchPlayer[] = [];
let matchSets: MatchSet[] = [];
let feedEvents: FeedEvent[] = [];

// Helper: Generate ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Helper: Calculate display level from internal rating
const calculateLevel = (rating: number): number => {
  // Simple mapping: rating 0-2800 → level 0.0-7.0
  const level = (rating / 400);
  return Math.max(0, Math.min(7, Number(level.toFixed(1))));
};

// Helper: Calculate internal rating from level
const calculateRating = (level: number): number => {
  return level * 400;
};

// --- User Service ---
export const createUser = async (data: {
  username: string;
  displayName: string;
  sports: Sport[];
}): Promise<User> => {
  // Check username uniqueness
  if (users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) {
    throw new Error('Username already exists');
  }

  const user: User = {
    id: generateId(),
    username: data.username,
    displayName: data.displayName,
    sports: data.sports,
    createdAt: new Date().toISOString(),
  };

  users.push(user);

  // Initialize ratings for selected sports
  for (const sport of data.sports) {
    const rating: UserRating = {
      id: generateId(),
      userId: user.id,
      sport,
      rating: 1000, // Initial Elo-like rating
      level: 2.5, // Will be set during onboarding
      reliability: Config.rating.initialReliability,
      matchesPlayed: 0,
      updatedAt: new Date().toISOString(),
    };
    userRatings.push(rating);
  }

  return user;
};

export const setUserStartingLevel = async (userId: string, sport: Sport, level: number): Promise<void> => {
  const rating = userRatings.find(r => r.userId === userId && r.sport === sport);
  if (rating) {
    rating.level = Math.max(0, Math.min(Config.rating.onboardingMax, level));
    rating.rating = calculateRating(rating.level);
    rating.updatedAt = new Date().toISOString();
  }
};

export const getUserById = async (userId: string): Promise<User | null> => {
  return users.find(u => u.id === userId) || null;
};

export const searchUsersByUsername = async (query: string): Promise<User[]> => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  
  return users
    .filter(u => u.username.toLowerCase().includes(lowerQuery))
    .slice(0, 20); // Limit results
};

export const getUserRatings = async (userId: string): Promise<UserRating[]> => {
  return userRatings.filter(r => r.userId === userId);
};

// --- Friend Request Service ---
export const sendFriendRequest = async (senderId: string, receiverId: string): Promise<FriendRequest> => {
  // Validation
  if (senderId === receiverId) {
    throw new Error('Cannot send friend request to yourself');
  }

  // Check if already friends
  const existingFriendship = friendships.find(
    f => (f.user1Id === senderId && f.user2Id === receiverId) ||
         (f.user1Id === receiverId && f.user2Id === senderId)
  );
  if (existingFriendship) {
    throw new Error('Already friends');
  }

  // Check for existing request
  const existingRequest = friendRequests.find(
    r => r.status === 'pending' &&
         ((r.senderId === senderId && r.receiverId === receiverId) ||
          (r.senderId === receiverId && r.receiverId === senderId))
  );
  if (existingRequest) {
    throw new Error('Friend request already exists');
  }

  const request: FriendRequest = {
    id: generateId(),
    senderId,
    receiverId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  friendRequests.push(request);
  return request;
};

export const respondToFriendRequest = async (
  requestId: string, 
  userId: string, 
  accept: boolean
): Promise<{ request: FriendRequest; friendship?: Friendship }> => {
  const request = friendRequests.find(r => r.id === requestId);
  if (!request) {
    throw new Error('Friend request not found');
  }

  if (request.receiverId !== userId) {
    throw new Error('Unauthorized');
  }

  if (request.status !== 'pending') {
    throw new Error('Request already processed');
  }

  request.status = accept ? 'accepted' : 'rejected';

  let friendship: Friendship | undefined;
  if (accept) {
    friendship = {
      id: generateId(),
      user1Id: request.senderId,
      user2Id: request.receiverId,
      createdAt: new Date().toISOString(),
    };
    friendships.push(friendship);
  }

  return { request, friendship };
};

export const getIncomingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  const requests = friendRequests.filter(r => r.receiverId === userId && r.status === 'pending');
  // Populate sender info
  return requests.map(r => ({
    ...r,
    sender: users.find(u => u.id === r.senderId),
  }));
};

export const getOutgoingFriendRequests = async (userId: string): Promise<FriendRequest[]> => {
  const requests = friendRequests.filter(r => r.senderId === userId && r.status === 'pending');
  // Populate receiver info
  return requests.map(r => ({
    ...r,
    receiver: users.find(u => u.id === r.receiverId),
  }));
};

export const getFriends = async (userId: string): Promise<Friendship[]> => {
  const userFriendships = friendships.filter(
    f => f.user1Id === userId || f.user2Id === userId
  );
  
  // Populate friend info
  return userFriendships.map(f => {
    const friendId = f.user1Id === userId ? f.user2Id : f.user1Id;
    return {
      ...f,
      friend: users.find(u => u.id === friendId),
    };
  });
};

// --- Group Service ---
export const createGroup = async (data: {
  name: string;
  sportFocus: Sport | 'mixed';
  ownerId: string;
  invitedFriendIds: string[];
}): Promise<{ group: Group; members: GroupMember[] }> => {
  const group: Group = {
    id: generateId(),
    name: data.name,
    sportFocus: data.sportFocus,
    ownerId: data.ownerId,
    createdAt: new Date().toISOString(),
  };
  groups.push(group);

  const members: GroupMember[] = [];

  // Add owner
  const ownerMember: GroupMember = {
    id: generateId(),
    groupId: group.id,
    userId: data.ownerId,
    role: 'owner',
    joinedAt: new Date().toISOString(),
  };
  groupMembers.push(ownerMember);
  members.push(ownerMember);

  // Add invited friends
  for (const friendId of data.invitedFriendIds) {
    const member: GroupMember = {
      id: generateId(),
      groupId: group.id,
      userId: friendId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    };
    groupMembers.push(member);
    members.push(member);

    // Create feed event
    const event: FeedEvent = {
      id: generateId(),
      type: 'user_joined_group',
      userId: friendId,
      groupId: group.id,
      createdAt: new Date().toISOString(),
    };
    feedEvents.push(event);
  }

  // Create feed event for group creation
  const groupEvent: FeedEvent = {
    id: generateId(),
    type: 'group_created',
    userId: data.ownerId,
    groupId: group.id,
    createdAt: new Date().toISOString(),
  };
  feedEvents.push(groupEvent);

  return { group, members };
};

export const getUserGroups = async (userId: string): Promise<Group[]> => {
  const userMemberships = groupMembers.filter(m => m.userId === userId);
  const userGroups = userMemberships
    .map(m => groups.find(g => g.id === m.groupId))
    .filter((g): g is Group => g !== undefined);

  // Populate member count
  return userGroups.map(g => ({
    ...g,
    memberCount: groupMembers.filter(m => m.groupId === g.id).length,
  }));
};

export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  const members = groupMembers.filter(m => m.groupId === groupId);
  // Populate user info
  return members.map(m => ({
    ...m,
    user: users.find(u => u.id === m.userId),
  }));
};

export const getGroupById = async (groupId: string): Promise<Group | null> => {
  const group = groups.find(g => g.id === groupId);
  if (!group) return null;

  return {
    ...group,
    memberCount: groupMembers.filter(m => m.groupId === group.id).length,
  };
};

export const addGroupMember = async (groupId: string, userId: string): Promise<GroupMember> => {
  // Check if already member
  const existing = groupMembers.find(m => m.groupId === groupId && m.userId === userId);
  if (existing) {
    throw new Error('User is already a member');
  }

  const member: GroupMember = {
    id: generateId(),
    groupId,
    userId,
    role: 'member',
    joinedAt: new Date().toISOString(),
  };

  groupMembers.push(member);

  // Create feed event
  const event: FeedEvent = {
    id: generateId(),
    type: 'user_joined_group',
    userId,
    groupId,
    createdAt: new Date().toISOString(),
  };
  feedEvents.push(event);

  return member;
};

// --- Match Service ---
export const createMatch = async (data: {
  groupId: string;
  sport: Sport;
  format: MatchFormat;
  type: MatchType;
  createdBy: string;
  teamA: string[]; // [userId] for singles, [userId1, userId2] for doubles
  teamB: string[];
  sets: Array<{ teamAScore: number; teamBScore: number; tiebreak?: string }>;
  winnerTeam: 'A' | 'B';
}): Promise<Match> => {
  const match: Match = {
    id: generateId(),
    groupId: data.groupId,
    sport: data.sport,
    format: data.format,
    type: data.type,
    status: 'pending',
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
  };
  matches.push(match);

  // Create match players
  const isWinnerA = data.winnerTeam === 'A';
  for (const userId of data.teamA) {
    const player: MatchPlayer = {
      id: generateId(),
      matchId: match.id,
      userId,
      team: 'A',
      isWinner: isWinnerA,
    };
    matchPlayers.push(player);
  }
  for (const userId of data.teamB) {
    const player: MatchPlayer = {
      id: generateId(),
      matchId: match.id,
      userId,
      team: 'B',
      isWinner: !isWinnerA,
    };
    matchPlayers.push(player);
  }

  // Create match sets
  data.sets.forEach((set, index) => {
    const matchSet: MatchSet = {
      id: generateId(),
      matchId: match.id,
      setNumber: index + 1,
      teamAScore: set.teamAScore,
      teamBScore: set.teamBScore,
      tiebreak: set.tiebreak,
    };
    matchSets.push(matchSet);
  });

  return match;
};

export const confirmMatch = async (matchId: string, confirmerId: string): Promise<Match> => {
  const match = matches.find(m => m.id === matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (match.status === 'confirmed') {
    throw new Error('Match already confirmed');
  }

  const players = matchPlayers.filter(p => p.matchId === matchId);
  const confirmerPlayer = players.find(p => p.userId === confirmerId);
  
  if (!confirmerPlayer) {
    throw new Error('You are not a player in this match');
  }

  // Check confirmation rule
  const opponents = players.filter(p => p.team !== confirmerPlayer.team);
  if (opponents.length === 0) {
    throw new Error('Invalid match setup');
  }

  // Confirm match
  match.status = 'confirmed';
  match.confirmedAt = new Date().toISOString();

  // Apply rating changes if competitive
  if (match.type === 'competitive') {
    await applyRatingsForMatch(matchId);
  }

  // Create feed event
  const event: FeedEvent = {
    id: generateId(),
    type: 'match_confirmed',
    userId: confirmerId,
    matchId: match.id,
    groupId: match.groupId,
    createdAt: new Date().toISOString(),
  };
  feedEvents.push(event);

  return match;
};

const applyRatingsForMatch = async (matchId: string): Promise<void> => {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  const players = matchPlayers.filter(p => p.matchId === matchId);

  // Calculate team average ratings
  const teamAPlayers = players.filter(p => p.team === 'A');
  const teamBPlayers = players.filter(p => p.team === 'B');

  const teamARatings = teamAPlayers.map(p => {
    const rating = userRatings.find(r => r.userId === p.userId && r.sport === match.sport);
    return rating ? rating.rating : 1000;
  });
  const teamBRatings = teamBPlayers.map(p => {
    const rating = userRatings.find(r => r.userId === p.userId && r.sport === match.sport);
    return rating ? rating.rating : 1000;
  });

  const teamAAvg = teamARatings.reduce((sum, r) => sum + r, 0) / teamARatings.length;
  const teamBAvg = teamBRatings.reduce((sum, r) => sum + r, 0) / teamBRatings.length;

  // Update each player's rating
  for (const player of players) {
    const rating = userRatings.find(r => r.userId === player.userId && r.sport === match.sport);
    if (!rating) continue;

    const opponentAvg = player.team === 'A' ? teamBAvg : teamAAvg;
    const won = player.isWinner;

    // Store before values
    player.ratingBefore = rating.rating;
    player.levelBefore = rating.level;
    player.reliabilityBefore = rating.reliability;

    // Elo calculation
    const K = 32 * (1 - rating.reliability); // Higher K for lower reliability
    const expectedScore = 1 / (1 + Math.pow(10, (opponentAvg - rating.rating) / 400));
    const actualScore = won ? 1 : 0;
    const ratingChange = K * (actualScore - expectedScore);

    rating.rating += ratingChange;
    rating.level = calculateLevel(rating.rating);
    rating.matchesPlayed += 1;
    rating.reliability = Math.min(
      Config.rating.maxReliability,
      rating.reliability + Config.rating.reliabilityIncrement
    );
    rating.updatedAt = new Date().toISOString();

    // Store after values
    player.ratingAfter = rating.rating;
    player.levelAfter = rating.level;
    player.reliabilityAfter = rating.reliability;
  }
};

export const getMatchById = async (matchId: string): Promise<Match | null> => {
  const match = matches.find(m => m.id === matchId);
  if (!match) return null;

  return {
    ...match,
    group: groups.find(g => g.id === match.groupId),
    players: matchPlayers
      .filter(p => p.matchId === matchId)
      .map(p => ({
        ...p,
        user: users.find(u => u.id === p.userId),
      })),
    sets: matchSets.filter(s => s.matchId === matchId),
  };
};

export const getGroupMatches = async (groupId: string, limit?: number): Promise<Match[]> => {
  let groupMatches = matches
    .filter(m => m.groupId === groupId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (limit) {
    groupMatches = groupMatches.slice(0, limit);
  }

  // Populate players and sets
  return groupMatches.map(m => ({
    ...m,
    players: matchPlayers
      .filter(p => p.matchId === m.id)
      .map(p => ({
        ...p,
        user: users.find(u => u.id === p.userId),
      })),
    sets: matchSets.filter(s => s.matchId === m.id),
  }));
};

// --- Leaderboard Service ---
export const getGroupLeaderboard = async (
  groupId: string,
  sport: Sport,
  period: 'monthly' | 'alltime'
): Promise<any[]> => {
  const members = groupMembers.filter(m => m.groupId === groupId);
  
  // Get all confirmed matches for this group and sport
  let groupMatches = matches.filter(
    m => m.groupId === groupId && m.sport === sport && m.status === 'confirmed'
  );

  // Filter by period
  if (period === 'monthly') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    groupMatches = groupMatches.filter(m => new Date(m.createdAt) >= monthStart);
  }

  const leaderboard = members.map(member => {
    const rating = userRatings.find(r => r.userId === member.userId && r.sport === sport);
    
    // Calculate record
    const playerMatches = groupMatches.filter(m => {
      const players = matchPlayers.filter(p => p.matchId === m.id);
      return players.some(p => p.userId === member.userId);
    });

    const wins = playerMatches.filter(m => {
      const players = matchPlayers.filter(p => p.matchId === m.id);
      const player = players.find(p => p.userId === member.userId);
      return player?.isWinner;
    }).length;

    const losses = playerMatches.length - wins;
    const winPercentage = playerMatches.length > 0 ? (wins / playerMatches.length) * 100 : 0;

    return {
      userId: member.userId,
      user: users.find(u => u.id === member.userId),
      level: rating?.level || 0,
      reliability: rating?.reliability || 0,
      wins,
      losses,
      winPercentage,
    };
  });

  // Sort: level desc, then reliability desc
  leaderboard.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.reliability - a.reliability;
  });

  // Add rank
  return leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};

// --- Feed Service ---
export const getUserFeed = async (userId: string): Promise<FeedEvent[]> => {
  // Get user's friends
  const userFriends = friendships
    .filter(f => f.user1Id === userId || f.user2Id === userId)
    .map(f => f.user1Id === userId ? f.user2Id : f.user1Id);

  // Get user's groups
  const userGroupIds = groupMembers
    .filter(m => m.userId === userId)
    .map(m => m.groupId);

  // Filter feed events
  const relevantEvents = feedEvents.filter(event => {
    // Events in my groups
    if (event.groupId && userGroupIds.includes(event.groupId)) return true;
    // Events by my friends
    if (event.userId && userFriends.includes(event.userId)) return true;
    return false;
  });

  // Sort by date desc
  relevantEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Populate related data
  return relevantEvents.map(event => ({
    ...event,
    user: users.find(u => u.id === event.userId),
    match: event.matchId ? matches.find(m => m.id === event.matchId) : undefined,
    group: event.groupId ? groups.find(g => g.id === event.groupId) : undefined,
  }));
};

// --- Account Deletion ---
export const deleteUserAccount = async (userId: string): Promise<void> => {
  // Remove user
  users = users.filter(u => u.id !== userId);
  
  // Remove ratings
  userRatings = userRatings.filter(r => r.userId !== userId);
  
  // Remove friend requests
  friendRequests = friendRequests.filter(r => r.senderId !== userId && r.receiverId !== userId);
  
  // Remove friendships
  friendships = friendships.filter(f => f.user1Id !== userId && f.user2Id !== userId);
  
  // Remove group memberships (but preserve groups)
  groupMembers = groupMembers.filter(m => m.userId !== userId);
  
  // Update group ownership to first remaining member or delete group if no members
  const ownedGroups = groups.filter(g => g.ownerId === userId);
  for (const group of ownedGroups) {
    const remainingMembers = groupMembers.filter(m => m.groupId === group.id);
    if (remainingMembers.length > 0) {
      // Transfer ownership
      group.ownerId = remainingMembers[0].userId;
      remainingMembers[0].role = 'owner';
    } else {
      // Delete empty group
      groups = groups.filter(g => g.id !== group.id);
    }
  }
  
  // Keep match history but replace user references with placeholder
  // (In real implementation, this would mark user as "Deleted User")
  // For now, we just keep the matches intact
};
