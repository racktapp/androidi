import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert , getSupabaseClient } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, LoadingSpinner } from '@/components';

const supabase = getSupabaseClient();

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [originalUsername, setOriginalUsername] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name || '');
        setUsername(profile.username || '');
        setOriginalUsername(profile.username || '');
        setEmail(profile.email || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkUsernameAvailability = useCallback(async () => {
    if (!username || username === originalUsername) return;

    setCheckingUsername(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      setUsernameAvailable(!data);
    } catch {
      // No user found = available
      setUsernameAvailable(true);
    } finally {
      setCheckingUsername(false);
    }
  }, [originalUsername, username]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (username && username !== originalUsername) {
      const timer = setTimeout(() => {
        void checkUsernameAvailability();
      }, 500);
      return () => clearTimeout(timer);
    }

    setUsernameAvailable(true);
  }, [checkUsernameAvailability, originalUsername, username]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      showAlert('Error', 'Display name is required');
      return;
    }

    if (!username.trim()) {
      showAlert('Error', 'Username is required');
      return;
    }

    if (!usernameAvailable) {
      showAlert('Error', 'Username is already taken');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          display_name: displayName.trim(),
          username: username.toLowerCase().trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      showAlert('Success', 'Profile updated successfully');
      router.back();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your full name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
            <Text style={styles.helper}>
              This is how others see your name
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWithIcon}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput
                style={[styles.input, styles.inputWithPrefixPadding]}
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {checkingUsername && (
                <View style={styles.inputIcon}>
                  <LoadingSpinner size={16} />
                </View>
              )}
              {!checkingUsername && username !== originalUsername && (
                <View style={styles.inputIcon}>
                  <MaterialIcons
                    name={usernameAvailable ? 'check-circle' : 'error'}
                    size={20}
                    color={usernameAvailable ? Colors.success : Colors.danger}
                  />
                </View>
              )}
            </View>
            {!usernameAvailable && (
              <Text style={styles.error}>Username already taken</Text>
            )}
            <Text style={styles.helper}>
              Used for @mentions and friend search
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={email}
              editable={false}
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.helper}>
              Email cannot be changed
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button
          title={saving ? 'Saving...' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving || checkingUsername || !usernameAvailable}
          fullWidth
          icon={saving ? <LoadingSpinner size={20} /> : undefined}
        />
      </View>
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.xl,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.textPrimary,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputWithIcon: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPrefix: {
    position: 'absolute',
    left: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    fontWeight: Typography.weights.medium,
    zIndex: 1,
  },
  inputWithPrefixPadding: {
    paddingLeft: Spacing.lg + 16,
  },
  inputIcon: {
    position: 'absolute',
    right: Spacing.lg,
  },
  helper: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  error: {
    fontSize: Typography.sizes.xs,
    color: Colors.danger,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
});
