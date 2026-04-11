import { useCallback, useMemo } from 'react';
import { friendsService } from '@/services/friends';

export function useFriends() {
  const searchUsers = useCallback(async (query: string) => {
    return await friendsService.searchUsers(query);
  }, []);

  const sendFriendRequest = useCallback(async (senderId: string, receiverId: string) => {
    await friendsService.sendFriendRequest(receiverId);
  }, []);

  const respondToRequest = useCallback(async (requestId: string, userId: string, accept: boolean) => {
    await friendsService.respondToRequest(requestId, accept);
  }, []);

  const getIncomingRequests = useCallback(async (userId: string) => {
    return await friendsService.getIncomingRequests(userId);
  }, []);

  const getOutgoingRequests = useCallback(async (userId: string) => {
    return await friendsService.getOutgoingRequests(userId);
  }, []);

  const getFriends = useCallback(async (userId: string) => {
    return await friendsService.getFriends(userId);
  }, []);

  return useMemo(() => ({
    searchUsers,
    sendFriendRequest,
    respondToRequest,
    getIncomingRequests,
    getOutgoingRequests,
    getFriends,
  }), [
    getFriends,
    getIncomingRequests,
    getOutgoingRequests,
    respondToRequest,
    searchUsers,
    sendFriendRequest,
  ]);
}
