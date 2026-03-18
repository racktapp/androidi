import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsRow, SettingsSection } from '@/components/settings';
import { LoadingSpinner } from '@/components';
import { getSupabaseClient } from '@/template';
import { preferencesService } from '@/services/preferences';

const supabase = getSupabaseClient();

type ProfileVisibility = 'public' | 'friends' | 'private';
type WhoCanAdd = 'everyone' | 'friends_of_friends' | 'nobody';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileVisibility, setProfileVisibility] = useState<ProfileVisibility>('friends');
  const [whoCanAdd, setWhoCanAdd] = useState<WhoCanAdd>('everyone');

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadPreferences();
    }
  }, [userId]);

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadPreferences = async () => {
    if (!userId) return;

    try {
      const prefs = await preferencesService.getPreferences(userId);
      setProfileVisibility(prefs.profileVisibility);
      setWhoCanAdd(prefs.whoCanAdd);
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateVisibility = async (value: ProfileVisibility) => {
    if (!userId) return;

    try {
      setProfileVisibility(value);
      await preferencesService.updatePreferences(userId, {
        profileVisibility: value,
      });
    } catch (err: any) {
      showAlert('Error', 'Failed to update privacy settings');
      console.error('Update error:', err);
    }
  };

  const updateWhoCanAdd = async (value: WhoCanAdd) => {
    if (!userId) return;

    try {
      setWhoCanAdd(value);
      await preferencesService.updatePreferences(userId, {
        whoCanAdd: value,
      });
    } catch (err: any) {
      showAlert('Error', 'Failed to update privacy settings');
      console.error('Update error:', err);
    }
  };

  const getVisibilityLabel = (value: ProfileVisibility) => {
    switch (value) {
      case 'public':
        return 'Public';
      case 'friends':
        return 'Friends Only';
      case 'private':
        return 'Private';
    }
  };

  const getWhoCanAddLabel = (value: WhoCanAdd) => {
    switch (value) {
      case 'everyone':
        return 'Everyone';
      case 'friends_of_friends':
        return 'Friends of Friends';
      case 'nobody':
        return 'Nobody';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Privacy & Safety</Text>
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
        <Text style={styles.headerTitle}>Privacy & Safety</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Profile Visibility">
          <View style={styles.optionsGroup}>
            {(['public', 'friends', 'private'] as ProfileVisibility[]).map((option) => (
              <Pressable
                key={option}
                style={styles.optionRow}
                onPress={() => updateVisibility(option)}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{getVisibilityLabel(option)}</Text>
                  <Text style={styles.optionSubtitle}>
                    {option === 'public' && 'Anyone can see your profile and stats'}
                    {option === 'friends' && 'Only friends can see your details'}
                    {option === 'private' && 'Only you can see your profile'}
                  </Text>
                </View>
                <View style={[
                  styles.radio,
                  profileVisibility === option && styles.radioActive,
                ]}>
                  {profileVisibility === option && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </SettingsSection>

        <SettingsSection title="Who Can Add You">
          <View style={styles.optionsGroup}>
            {(['everyone', 'friends_of_friends', 'nobody'] as WhoCanAdd[]).map((option) => (
              <Pressable
                key={option}
                style={styles.optionRow}
                onPress={() => updateWhoCanAdd(option)}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{getWhoCanAddLabel(option)}</Text>
                  <Text style={styles.optionSubtitle}>
                    {option === 'everyone' && 'Anyone can send you friend requests'}
                    {option === 'friends_of_friends' && 'Only mutual connections can add you'}
                    {option === 'nobody' && 'No one can send friend requests'}
                  </Text>
                </View>
                <View style={[
                  styles.radio,
                  whoCanAdd === option && styles.radioActive,
                ]}>
                  {whoCanAdd === option && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </SettingsSection>

        <SettingsSection title="Blocked Users">
          <SettingsRow
            icon="block"
            title="Blocked Users"
            subtitle="Manage blocked accounts"
            onPress={() => router.push('/settings/blocked-users' as any)}
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
  optionsGroup: {
    gap: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  optionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.textPrimary,
  },
  optionSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
});
