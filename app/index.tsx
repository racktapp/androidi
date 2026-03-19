import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { logStartup, logStartupError } from '@/utils/startupDiagnostics';
import { getPostAuthRoute } from '@/utils/authRedirect';
import { Colors } from '@/constants/theme';

const supabase = getSupabaseClient();

export default function IndexScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const checkAuthAndOnboarding = useCallback(async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        logStartup('auth: no active user, redirecting to /auth/email');
        // Not authenticated -> go to auth
        router.replace('/auth/email');
        return;
      }

      const postAuthRoute = await getPostAuthRoute(user.id);

      if (postAuthRoute === '/onboarding') {
        logStartup('auth: onboarding incomplete, redirecting to /onboarding');
      } else {
        logStartup('auth: complete, redirecting to /(tabs)/dashboard');
      }

      router.replace(postAuthRoute);
    } catch (error) {
      console.error('Auth check error:', error);
      const message = error instanceof Error ? error.message : 'Unknown auth init error';
      logStartupError(`auth init failed: ${message}`);
      router.replace('/auth/email');
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    logStartup('auth: starting session check');
    checkAuthAndOnboarding();
  }, [checkAuthAndOnboarding]);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
