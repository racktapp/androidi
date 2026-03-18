import { friendsService } from '@/services/friends';

export function useFriends() {
  const searchUsers = async (query: string) => {
    return await friendsService.searchUsers(query);
  };

  const sendFriendRequest = async (senderId: string, receiverId: string) => {
    await friendsService.sendFriendRequest(receiverId);
  };

  const respondToRequest = async (requestId: string, userId: string, accept: boolean) => {
    await friendsService.respondToRequest(requestId, accept);
  };

  const getIncomingRequests = async (userId: string) => {
    return await friendsService.getIncomingRequests(userId);
  };

  const getOutgoingRequests = async (userId: string) => {
    return await friendsService.getOutgoingRequests(userId);
  };

  const getFriends = async (userId: string) => {
    return await friendsService.getFriends(userId);
  };

  return {
    searchUsers,
    sendFriendRequest,
    respondToRequest,
    getIncomingRequests,
    getOutgoingRequests,
    getFriends,
  };
}
