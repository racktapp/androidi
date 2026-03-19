
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, LoadingSpinner , UserAvatar, UserName } from '@/components';
import { Config, Sport, MatchFormat, MatchType } from '@/constants/config';
import { useGroups } from '@/hooks/useGroups';
import { useMatches } from '@/hooks/useMatches';
import { Group, GroupMember } from '@/types';
import { getSupabaseClient } from '@/template';
import { friendsService } from '@/services/friends';

const supabase = getSupabaseClient();

export default function AddMatchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getUserGroups, getGroupMembers } = useGroups();
  const { createMatch } = useMatches();

  const [userId, setUserId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<'group' | '1v1'>('group');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [showOpponentPicker, setShowOpponentPicker] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [sport, setSport] = useState<Sport>('tennis');
  const [format, setFormat] = useState<MatchFormat>('singles');
  const [type, setType] = useState<MatchType>('competitive');
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [sets, setSets] = useState<{ teamAScore: number; teamBScore: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadGroups = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getUserGroups(userId);
      setGroups(data);
    } catch (err) {
      console.error('Error loading groups:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  }, [getUserGroups, userId]);

  const loadFriends = useCallback(async () => {
    if (!userId) return;
    setIsLoadingFriends(true);
    try {
      const data = await friendsService.getFriends(userId);
      setFriends(data);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [userId]);

  const loadMembers = useCallback(async () => {
    if (!selectedGroup) return;
    setIsLoadingMembers(true);
    try {
      const data = await getGroupMembers(selectedGroup);
      setMembers(data);
    } catch (err) {
      console.error('Error loading members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [getGroupMembers, selectedGroup]);

  useEffect(() => {
    if (userId) {
      void loadGroups();
      if (matchMode === '1v1') {
        void loadFriends();
      }
    }
  }, [loadFriends, loadGroups, matchMode, userId]);

  useEffect(() => {
    if (selectedGroup) {
      void loadMembers();
    }
  }, [loadMembers, selectedGroup]);

  const addSet = () => {
    if (sets.length < 3) {
      setSets([...sets, { teamAScore: 0, teamBScore: 0 }]);
    }
  };

  const updateSetScore = (index: number, team: 'A' | 'B', delta: number) => {
    const newSets = [...sets];
    const currentScore = team === 'A' ? newSets[index].teamAScore : newSets[index].teamBScore;
    const newScore = Math.max(0, Math.min(7, currentScore + delta));
    
    if (team === 'A') {
      newSets[index].teamAScore = newScore;
    } else {
      newSets[index].teamBScore = newScore;
    }
    setSets(newSets);
  };

  const togglePlayer = (team: 'A' | 'B', playerId: string) => {
    const currentTeam = team === 'A' ? teamA : teamB;
    const setTeam = team === 'A' ? setTeamA : setTeamB;

    if (currentTeam.includes(playerId)) {
      setTeam(currentTeam.filter(id => id !== playerId));
    } else {
      const maxPlayers = format === 'singles' ? 1 : 2;
      if (currentTeam.length < maxPlayers) {
        setTeam([...currentTeam, playerId]);
      }
    }
  };

  // Compute match state
  const matchState = useMemo(() => {
    const setsWonA = sets.filter(s => s.teamAScore > s.teamBScore).length;
    const setsWonB = sets.filter(s => s.teamBScore > s.teamAScore).length;
    const hasTiedSet = sets.some(s => s.teamAScore === s.teamBScore);
    
    let winner: 'A' | 'B' | null = null;
    let canSubmit = false;
    let submitMessage = '';

    if (sets.length === 0) {
      submitMessage = 'Add at least one set';
    } else if (hasTiedSet) {
      submitMessage = 'Each set needs a winner';
    } else if (setsWonA === 2 || setsWonB === 2) {
      winner = setsWonA === 2 ? 'A' : 'B';
      canSubmit = true;
      submitMessage = `Submit Match ${setsWonA}–${setsWonB} ✓`;
    } else if (sets.length === 1) {
      winner = setsWonA === 1 ? 'A' : 'B';
      canSubmit = true;
      submitMessage = `Submit Match ${setsWonA}–${setsWonB} ✓`;
    } else if (setsWonA === 1 && setsWonB === 1) {
      submitMessage = 'Add a deciding set';
    } else {
      canSubmit = true;
      winner = setsWonA > setsWonB ? 'A' : 'B';
      submitMessage = `Submit Match ${setsWonA}–${setsWonB} ✓`;
    }

    return { setsWonA, setsWonB, winner, canSubmit, submitMessage, hasTiedSet };
  }, [sets]);

  const validateMatch = () => {
    if (matchMode === 'group' && !selectedGroup) {
      return 'Please select a group';
    }

    if (matchMode === '1v1' && !selectedOpponent) {
      return 'Please select an opponent';
    }
    
    if (matchMode === 'group') {
      const requiredPlayers = format === 'singles' ? 1 : 2;
      if (teamA.length !== requiredPlayers || teamB.length !== requiredPlayers) {
        return `Each team needs ${requiredPlayers} player${requiredPlayers > 1 ? 's' : ''}`;
      }
    }

    if (!matchState.canSubmit) {
      return matchState.submitMessage;
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateMatch();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!userId) return;

    setSubmitting(true);
    setError(null);

    try {
      if (!matchState.winner) {
        setError('Cannot determine match winner');
        setSubmitting(false);
        return;
      }

      let finalTeamA = teamA;
      let finalTeamB = teamB;

      // For 1v1 mode, set teams automatically
      if (matchMode === '1v1' && selectedOpponent) {
        finalTeamA = [userId];
        finalTeamB = [selectedOpponent];
      }

      const match = await createMatch({
        groupId: matchMode === 'group' ? selectedGroup : null,
        sport,
        format: matchMode === '1v1' ? 'singles' : format,
        type,
        createdBy: userId,
        teamA: finalTeamA,
        teamB: finalTeamB,
        sets,
        winnerTeam: matchState.winner,
      });

      router.push(`/match/${match.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create match');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFriend = selectedOpponent 
    ? friends.find(f => f.friend.id === selectedOpponent)?.friend 
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/(tabs)/dashboard')}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.headerLogo}
            contentFit="contain"
            transition={200}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Add Match</Text>
        <Pressable onPress={() => router.push('/settings')}>
          <MaterialIcons name="settings" size={24} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Match Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Match Type</Text>
          <View style={styles.modeCards}>
            <Pressable
              style={[styles.modeCard, matchMode === 'group' && styles.modeCardSelected]}
              onPress={() => {
                setMatchMode('group');
                setSelectedOpponent(null);
                setTeamA([]);
                setTeamB([]);
              }}
            >
              <MaterialIcons 
                name="group" 
                size={24} 
                color={matchMode === 'group' ? Colors.primary : Colors.textMuted} 
              />
              <Text style={[styles.modeCardTitle, matchMode === 'group' && styles.modeCardTitleSelected]}>
                Group Match
              </Text>
              <Text style={[styles.modeCardHelper, matchMode === 'group' && styles.modeCardHelperSelected]}>
                Log match within a group
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeCard, matchMode === '1v1' && styles.modeCardSelected]}
              onPress={() => {
                setMatchMode('1v1');
                setSelectedGroup(null);
                setTeamA([]);
                setTeamB([]);
                if (userId && friends.length === 0) {
                  loadFriends();
                }
              }}
            >
              <MaterialIcons 
                name="sports-tennis" 
                size={24} 
                color={matchMode === '1v1' ? Colors.primary : Colors.textMuted} 
              />
              <Text style={[styles.modeCardTitle, matchMode === '1v1' && styles.modeCardTitleSelected]}>
                Quick 1v1
              </Text>
              <Text style={[styles.modeCardHelper, matchMode === '1v1' && styles.modeCardHelperSelected]}>
                Play with a friend
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Group Selection (only for group mode) */}
        {matchMode === 'group' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group</Text>
            {isLoadingGroups ? (
              <Text style={styles.helperText}>Loading groups...</Text>
            ) : groups.length === 0 ? (
              <Text style={styles.helperText}>No groups yet. Create one first.</Text>
            ) : (
              <View style={styles.optionsRow}>
                {groups.map(group => (
                  <Pressable
                    key={group.id}
                    style={[styles.chip, selectedGroup === group.id && styles.chipSelected]}
                    onPress={() => setSelectedGroup(group.id)}
                  >
                    <Text style={[styles.chipText, selectedGroup === group.id && styles.chipTextSelected]}>
                      {group.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Opponent Selection (only for 1v1 mode) */}
        {matchMode === '1v1' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Opponent</Text>
            {isLoadingFriends ? (
              <View style={styles.loadingContainer}>
                <LoadingSpinner size={24} />
                <Text style={styles.helperText}>Loading friends...</Text>
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="people-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No friends yet</Text>
                <Text style={styles.helperText}>Add friends to play 1v1 matches</Text>
              </View>
            ) : (
              <Pressable
                style={styles.dropdownButton}
                onPress={() => setShowOpponentPicker(true)}
              >
                {selectedFriend ? (
                  <View style={styles.dropdownSelected}>
                    <UserAvatar
                      name={selectedFriend.displayName || selectedFriend.username}
                      avatarUrl={selectedFriend.avatarUrl}
                      size={32}
                    />
                    <View style={styles.dropdownSelectedInfo}>
                      <UserName
                        profile={selectedFriend}
                        displayNameStyle={styles.dropdownSelectedName}
                        handleStyle={styles.dropdownSelectedHandle}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>Choose opponent</Text>
                )}
                <MaterialIcons name="arrow-drop-down" size={24} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}

        {/* Sport */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sport</Text>
          <View style={styles.optionsRow}>
            {Config.sports.map(s => (
              <Pressable
                key={s}
                style={[styles.sportChip, sport === s && styles.sportChipSelected]}
                onPress={() => setSport(s)}
              >
                <Image
                  source={s === 'tennis' ? require('@/assets/icons/tennis_icon.png') : require('@/assets/icons/padel_icon.png')}
                  style={[
                    styles.sportIcon,
                    sport !== s && styles.sportIconInactive,
                  ]}
                  contentFit="contain"
                  transition={0}
                />
                <Text style={[styles.sportChipText, sport === s && styles.sportChipTextSelected]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Format (only for group mode) */}
        {matchMode === 'group' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Format</Text>
            <View style={styles.optionsRow}>
              {Config.matchFormats.map(f => (
                <Pressable
                  key={f}
                  style={[styles.chip, format === f && styles.chipSelected]}
                  onPress={() => {
                    setFormat(f);
                    setTeamA([]);
                    setTeamB([]);
                  }}
                >
                  <Text style={[styles.chipText, format === f && styles.chipTextSelected]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.typeCards}>
            <Pressable
              style={[styles.typeCard, type === 'competitive' && styles.typeCardSelected]}
              onPress={() => setType('competitive')}
            >
              <Text style={[styles.typeCardTitle, type === 'competitive' && styles.typeCardTitleSelected]}>
                Competitive
              </Text>
              <Text style={[styles.typeCardHelper, type === 'competitive' && styles.typeCardHelperSelected]}>
                Affects ranking
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeCard, type === 'friendly' && styles.typeCardSelected]}
              onPress={() => setType('friendly')}
            >
              <Text style={[styles.typeCardTitle, type === 'friendly' && styles.typeCardTitleSelected]}>
                Friendly
              </Text>
              <Text style={[styles.typeCardHelper, type === 'friendly' && styles.typeCardHelperSelected]}>
                Does not affect ranking
              </Text>
            </Pressable>
          </View>
          {type === 'friendly' && (
            <Text style={styles.helperText}>Friendly matches won&apos;t change levels.</Text>
          )}
        </View>

        {/* Players (only for group mode) */}
        {matchMode === 'group' && selectedGroup && !isLoadingMembers && members.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Team A</Text>
              <View style={styles.playersGrid}>
                {members.map(member => (
                  <Pressable
                    key={`a-${member.userId}`}
                    style={[
                      styles.playerChip,
                      teamA.includes(member.userId) && styles.playerChipSelected,
                    ]}
                    onPress={() => togglePlayer('A', member.userId)}
                  >
                    <Text style={[
                      styles.playerChipText,
                      teamA.includes(member.userId) && styles.playerChipTextSelected,
                    ]}>
                      {member.user?.displayName || member.user?.username}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Team B</Text>
              <View style={styles.playersGrid}>
                {members.map(member => (
                  <Pressable
                    key={`b-${member.userId}`}
                    style={[
                      styles.playerChip,
                      teamB.includes(member.userId) && styles.playerChipSelected,
                    ]}
                    onPress={() => togglePlayer('B', member.userId)}
                  >
                    <Text style={[
                      styles.playerChipText,
                      teamB.includes(member.userId) && styles.playerChipTextSelected,
                    ]}>
                      {member.user?.displayName || member.user?.username}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Score */}
        {((matchMode === 'group' && teamA.length > 0 && teamB.length > 0) || (matchMode === '1v1' && selectedOpponent)) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Score</Text>
            
            {/* Team Names Header */}
            <View style={styles.teamsHeader}>
              <View style={styles.teamHeaderSide}>
                <Text style={styles.teamLabel}>{matchMode === '1v1' ? 'You' : 'Team A'}</Text>
                {matchMode === 'group' && (
                  <Text style={styles.teamPlayers}>
                    {teamA.map(id => {
                      const member = members.find(m => m.userId === id);
                      return member?.user?.displayName?.split(' ')[0] || 'Player';
                    }).join(' / ')}
                  </Text>
                )}
              </View>
              <View style={styles.teamHeaderSide}>
                <Text style={styles.teamLabel}>{matchMode === '1v1' ? 'Opponent' : 'Team B'}</Text>
                {matchMode === '1v1' && selectedOpponent && (
                  <Text style={styles.teamPlayers}>
                    {selectedFriend?.displayName?.split(' ')[0] || 'Opponent'}
                  </Text>
                )}
                {matchMode === 'group' && (
                  <Text style={styles.teamPlayers}>
                    {teamB.map(id => {
                      const member = members.find(m => m.userId === id);
                      return member?.user?.displayName?.split(' ')[0] || 'Player';
                    }).join(' / ')}
                  </Text>
                )}
              </View>
            </View>

            {/* Sets */}
            {sets.map((set, index) => {
              const setWinner = set.teamAScore > set.teamBScore ? 'A' : set.teamBScore > set.teamAScore ? 'B' : null;
              return (
                <View key={index} style={styles.setCard}>
                  <Text style={styles.setHeader}>Set {index + 1}</Text>
                  <View style={styles.setScoreRow}>
                    <View style={styles.scoreColumn}>
                      <View style={styles.scoreControl}>
                        <Pressable 
                          style={styles.scoreButton}
                          onPress={() => updateSetScore(index, 'A', -1)}
                        >
                          <MaterialIcons name="remove" size={20} color={Colors.textPrimary} />
                        </Pressable>
                        <Text style={styles.scoreValue}>{set.teamAScore}</Text>
                        <Pressable 
                          style={styles.scoreButton}
                          onPress={() => updateSetScore(index, 'A', 1)}
                        >
                          <MaterialIcons name="add" size={20} color={Colors.textPrimary} />
                        </Pressable>
                      </View>
                      <View style={styles.setWinnerIconContainer}>
                        {setWinner === 'A' && (
                          <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                        )}
                      </View>
                    </View>

                    <Text style={styles.scoreDivider}>–</Text>

                    <View style={styles.scoreColumn}>
                      <View style={styles.scoreControl}>
                        <Pressable 
                          style={styles.scoreButton}
                          onPress={() => updateSetScore(index, 'B', -1)}
                        >
                          <MaterialIcons name="remove" size={20} color={Colors.textPrimary} />
                        </Pressable>
                        <Text style={styles.scoreValue}>{set.teamBScore}</Text>
                        <Pressable 
                          style={styles.scoreButton}
                          onPress={() => updateSetScore(index, 'B', 1)}
                        >
                          <MaterialIcons name="add" size={20} color={Colors.textPrimary} />
                        </Pressable>
                      </View>
                      <View style={styles.setWinnerIconContainer}>
                        {setWinner === 'B' && (
                          <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Add Set Button */}
            {sets.length < 3 && (
              <Pressable style={styles.addSetButton} onPress={addSet}>
                <MaterialIcons name="add" size={20} color={Colors.primary} />
                <Text style={styles.addSetText}>Add Set</Text>
              </Pressable>
            )}

            {/* Match Summary */}
            {sets.length > 0 && (
              <View style={styles.matchSummary}>
                <Text style={styles.matchSummaryLabel}>Current Result:</Text>
                <Text style={styles.matchSummaryValue}>
                  {matchMode === '1v1' ? 'You' : 'Team A'} {matchState.setsWonA} – {matchState.setsWonB} {matchMode === '1v1' ? 'Opponent' : 'Team B'}
                </Text>
              </View>
            )}
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title={sets.length > 0 ? matchState.submitMessage : 'Submit Match'}
          onPress={handleSubmit}
          fullWidth
          disabled={submitting || !matchState.canSubmit}
          icon={submitting ? <LoadingSpinner size={20} /> : undefined}
        />
      </ScrollView>

      {/* Opponent Picker Modal */}
      <Modal
        visible={showOpponentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOpponentPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOpponentPicker(false)}
        >
          <Pressable
            style={[styles.pickerModal, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose Opponent</Text>
              <Pressable
                onPress={() => setShowOpponentPicker(false)}
                style={styles.pickerClose}
              >
                <MaterialIcons name="close" size={24} color={Colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {friends.map(friendship => (
                <Pressable
                  key={friendship.id}
                  style={[
                    styles.pickerItem,
                    selectedOpponent === friendship.friend.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedOpponent(friendship.friend.id);
                    setShowOpponentPicker(false);
                  }}
                >
                  <UserAvatar
                    name={friendship.friend.displayName || friendship.friend.username}
                    avatarUrl={friendship.friend.avatarUrl}
                    size={40}
                  />
                  <View style={styles.pickerItemInfo}>
                    <UserName
                      profile={friendship.friend}
                      displayNameStyle={styles.pickerItemName}
                      handleStyle={styles.pickerItemHandle}
                    />
                  </View>
                  {selectedOpponent === friendship.friend.id && (
                    <MaterialIcons name="check-circle" size={24} color={Colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sportChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sportChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  sportChipTextSelected: {
    fontWeight: Typography.weights.semibold,
  },
  sportIcon: {
    width: 16,
    height: 16,
  },
  sportIconInactive: {
    opacity: 0.5,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  chipTextSelected: {
    color: Colors.textPrimary,
    fontWeight: Typography.weights.semibold,
  },
  typeCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeCardSelected: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  typeCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  typeCardTitleSelected: {
    color: Colors.primary,
  },
  typeCardHelper: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  typeCardHelperSelected: {
    color: Colors.textMuted,
  },
  helperText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  playerChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  playerChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  playerChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  playerChipTextSelected: {
    fontWeight: Typography.weights.semibold,
  },
  teamsHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  teamHeaderSide: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  teamLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  teamPlayers: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  setCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  setHeader: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  setScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  scoreControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    minWidth: 48,
    textAlign: 'center',
  },
  scoreDivider: {
    fontSize: Typography.sizes.xl,
    color: Colors.textMuted,
    fontWeight: Typography.weights.bold,
  },
  setWinnerIconContainer: {
    height: 16,
    marginTop: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  addSetText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  matchSummary: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  matchSummaryLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
  },
  matchSummaryValue: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  modeCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modeCardSelected: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  modeCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  modeCardTitleSelected: {
    color: Colors.primary,
  },
  modeCardHelper: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modeCardHelperSelected: {
    color: Colors.textMuted,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textMuted,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 56,
  },
  dropdownSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  dropdownSelectedInfo: {
    flex: 1,
  },
  dropdownSelectedName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  dropdownSelectedHandle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  dropdownPlaceholder: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    height: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
  },
  pickerClose: {
    padding: Spacing.xs,
  },
  pickerList: {
    flexGrow: 1,
    flexShrink: 1,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemSelected: {
    backgroundColor: Colors.surfaceElevated,
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  pickerItemHandle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
});
