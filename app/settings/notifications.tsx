import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert , getSupabaseClient } from '@/template';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { SettingsRow, SettingsSection } from '@/components/settings';
import { LoadingSpinner } from '@/components';
import { preferencesService } from '@/services/preferences';

const supabase = getSupabaseClient();

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [matchConfirmations, setMatchConfirmations] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [groupActivity, setGroupActivity] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);

  useEffect(() => {
    loadUserId();
  }, []);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadPreferences = useCallback(async () => {
    if (!userId) return;

    try {
      const prefs = await preferencesService.getPreferences(userId);
      setMatchConfirmations(prefs.notifyMatchConfirmations);
      setFriendRequests(prefs.notifyFriendRequests);
      setGroupActivity(prefs.notifyGroupActivity);
      setWeeklySummary(prefs.notifyWeeklySummary);
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void loadPreferences();
    }
  }, [loadPreferences, userId]);

  const updatePreference = async (key: string, value: boolean) => {
    if (!userId) return;

    try {
      await preferencesService.updatePreferences(userId, {
        [key]: value,
      });
    } catch (err: any) {
      showAlert('Error', 'Failed to update preferences');
      console.error('Update error:', err);
    }
  };

  const handleToggle = (key: string, setter: (value: boolean) => void) => {
    return (value: boolean) => {
      setter(value);
      updatePreference(key, value);
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size={48} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Match Activity">
          <SettingsRow
            icon="sports-tennis"
            title="Match Confirmations"
            subtitle="When someone confirms your match"
            toggle
            toggleValue={matchConfirmations}
            onToggle={handleToggle('notifyMatchConfirmations', setMatchConfirmations)}
          />
        </SettingsSection>

        <SettingsSection title="Social">
          <SettingsRow
            icon="person-add"
            title="Friend Requests"
            subtitle="When someone sends you a friend request"
            toggle
            toggleValue={friendRequests}
            onToggle={handleToggle('notifyFriendRequests', setFriendRequests)}
          />
          <SettingsRow
            icon="group"
            title="Group Activity"
            subtitle="New members, matches, and updates"
            toggle
            toggleValue={groupActivity}
            onToggle={handleToggle('notifyGroupActivity', setGroupActivity)}
          />
        </SettingsSection>

        <SettingsSection title="Summaries">
          <SettingsRow
            icon="email"
            title="Weekly Summary"
            subtitle="Your weekly stats and highlights"
            toggle
            toggleValue={weeklySummary}
            onToggle={handleToggle('notifyWeeklySummary', setWeeklySummary)}
          />
        </SettingsSection>
      </ScrollView>
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
  headerTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
