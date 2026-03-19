
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert , getSupabaseClient } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { UserAvatar, UserName, LoadingSpinner } from '@/components';
import { SettingsRow, SettingsSection } from '@/components/settings';

import { userService } from '@/services/user';
import * as ExpoApplication from 'expo-application';

const supabase = getSupabaseClient();

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const userData = await userService.getUserById(authUser.id);
      setUser(userData);
    } catch (err) {
      console.error('Error loading user:', err);
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/auth/email');
            } catch (err: any) {
              showAlert('Error', err.message || 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data, including matches, ratings, and group memberships will be permanently deleted.\n\nType DELETE to confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Type DELETE in capital letters to confirm:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async (confirmation) => {
                    if (confirmation !== 'DELETE') {
                      showAlert('Error', 'Incorrect confirmation text');
                      return;
                    }

                    try {
                      await userService.deleteAccount(confirmation);
                      await supabase.auth.signOut();
                      router.replace('/auth/email');
                    } catch (err: any) {
                      showAlert('Error', err.message || 'Failed to delete account');
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
        },
      ]
    );
  };

  const appVersion = ExpoApplication.nativeApplicationVersion || '1.0.0';
  const buildNumber = ExpoApplication.nativeBuildVersion || '1';

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <UserAvatar
            name={user?.displayName || user?.username}
            avatarUrl={user?.avatarUrl}
            size={80}
          />
          <View style={styles.profileInfo}>
            <UserName
              profile={user}
              showHandle
              displayNameStyle={styles.profileName}
              handleStyle={styles.profileUsername}
            />
          </View>

        </View>

        {/* Account & Profile */}
        <SettingsSection title="Account & Profile">
          <SettingsRow
            icon="edit"
            title="Edit Profile"
            subtitle="Display name and username"
            onPress={() => router.push('/settings/edit-profile' as any)}
          />
        </SettingsSection>

        {/* Sports & Rankings */}
        <SettingsSection title="Sports & Rankings">
          <SettingsRow
            icon="sports-tennis"
            title="Your Levels"
            subtitle="Manage your Tennis and Padel ratings"
            onPress={() => router.push('/settings/edit-level')}
          />
          <SettingsRow
            icon="info-outline"
            title="How Ratings Work"
            subtitle="Learn about the Elo-style rating system"
            onPress={() => router.push('/settings/how-ratings-work' as any)}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsRow
            icon="notifications"
            title="Notification Preferences"
            subtitle="Manage match, friend, and group alerts"
            onPress={() => router.push('/settings/notifications' as any)}
          />
        </SettingsSection>

        {/* Privacy & Safety */}
        <SettingsSection title="Privacy & Safety">
          <SettingsRow
            icon="security"
            title="Privacy Settings"
            subtitle="Profile visibility and who can add you"
            onPress={() => router.push('/settings/privacy' as any)}
          />
        </SettingsSection>

        {/* Support */}
        <SettingsSection title="Support">
          <SettingsRow
            icon="bug-report"
            title="Report a Bug"
            subtitle="Help us improve Rackt"
            onPress={() => Linking.openURL('mailto:racktapp@gmail.com?subject=Bug Report')}
          />
          <SettingsRow
            icon="email"
            title="Contact Support"
            subtitle="Get help with your account"
            onPress={() => Linking.openURL('mailto:racktapp@gmail.com?subject=Support Request')}
          />
          <SettingsRow
            icon="help-outline"
            title="FAQ & How It Works"
            subtitle="Common questions and guides"
            onPress={() => router.push('/settings/how-ratings-work' as any)}
          />
        </SettingsSection>

        {/* Legal */}
        <SettingsSection title="Legal">
          <SettingsRow
            icon="description"
            title="Terms of Service"
            onPress={() => Linking.openURL('https://racktapp.com/terms')}
          />
          <SettingsRow
            icon="privacy-tip"
            title="Privacy Policy"
            onPress={() => Linking.openURL('https://racktapp.com/privacy')}
          />
          <SettingsRow
            icon="info"
            title={`Version ${appVersion} (${buildNumber})`}
            showChevron={false}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Danger Zone">
          <SettingsRow
            icon="logout"
            title="Log Out"
            onPress={handleLogout}
            showChevron={false}
          />
          <SettingsRow
            icon="delete-forever"
            title="Delete Account"
            subtitle="Permanently delete your account and all data"
            onPress={handleDeleteAccount}
            danger
            showChevron={false}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  profileInfo: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  profileName: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  profileUsername: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
  },
});
