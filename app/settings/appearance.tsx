import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { SettingsSection } from '@/components/settings';
import { LoadingSpinner } from '@/components';
import { getSupabaseClient } from '@/template';
import { preferencesService } from '@/services/preferences';

const supabase = getSupabaseClient();

type ThemePreference = 'system' | 'dark' | 'light';

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>('system');

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
      setThemePreference(prefs.themePreference);
    } catch (err) {
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateTheme = async (value: ThemePreference) => {
    if (!userId) return;

    try {
      setThemePreference(value);
      await preferencesService.updatePreferences(userId, {
        themePreference: value,
      });
      showAlert('Theme Updated', 'Restart the app to apply changes');
    } catch (err: any) {
      showAlert('Error', 'Failed to update theme preference');
      console.error('Update error:', err);
    }
  };

  const getThemeLabel = (value: ThemePreference) => {
    switch (value) {
      case 'system':
        return 'System Default';
      case 'dark':
        return 'Dark Mode';
      case 'light':
        return 'Light Mode';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Appearance</Text>
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
        <Text style={styles.headerTitle}>Appearance</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Theme">
          <View style={styles.optionsGroup}>
            {(['system', 'dark', 'light'] as ThemePreference[]).map((option) => (
              <Pressable
                key={option}
                style={styles.optionRow}
                onPress={() => updateTheme(option)}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{getThemeLabel(option)}</Text>
                  <Text style={styles.optionSubtitle}>
                    {option === 'system' && 'Follow device theme settings'}
                    {option === 'dark' && 'Always use dark theme'}
                    {option === 'light' && 'Always use light theme'}
                  </Text>
                </View>
                <View style={[
                  styles.radio,
                  themePreference === option && styles.radioActive,
                ]}>
                  {themePreference === option && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </SettingsSection>

        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            You may need to restart the app for theme changes to take full effect.
          </Text>
        </View>
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
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
});
