import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, DevSettings, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { initAdMob } from '../utils/admob';
import { Colors } from '@/constants/theme';
import { StartupErrorScreen } from '@/components/StartupErrorScreen';
import { logStartup, logStartupError } from '@/utils/startupDiagnostics';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logStartupError(`Root error boundary caught: ${error.message}`);
  }, [error]);

  return (
    <View style={styles.errorContainer}>
      <StartupErrorScreen
        title="App error"
        message={error.message || 'Unknown startup error'}
        stack={__DEV__ ? error.stack : undefined}
        onRetry={retry}
        onReload={() => DevSettings.reload()}
      />
    </View>
  );
}

export default function RootLayout() {
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const boot = useCallback(async () => {
    setBootState('loading');
    setBootError(null);

    try {
      logStartup('app start');
      logStartup('fonts: using bundled defaults');

      await initAdMob();
      logStartup('ads init complete (or safely skipped)');

      logStartup('router ready');
      setBootState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown boot error';
      logStartupError(`boot failed: ${message}`);
      setBootError(message);
      setBootState('error');
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  if (bootState === 'loading') {
    return <LoadingScreen />;
  }

  if (bootState === 'error') {
    return (
      <View style={styles.errorContainer}>
        <StartupErrorScreen
          title="Unable to start app"
          message={bootError ?? 'Unexpected error during startup.'}
          onRetry={boot}
          onReload={() => DevSettings.reload()}
        />
      </View>
    );
  }

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/email" />
          <Stack.Screen name="auth/verify" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="create-group" />
          <Stack.Screen name="group/[id]" />
          <Stack.Screen name="match/[id]" />
          <Stack.Screen name="profile/[userId]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="settings/edit-level" />
          <Stack.Screen name="settings/edit-profile" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="settings/blocked-users" />
          <Stack.Screen name="settings/how-ratings-work" />
          <Stack.Screen name="settings/appearance" />
          <Stack.Screen name="tournaments/index" />
          <Stack.Screen name="tournaments/create" />
          <Stack.Screen name="tournaments/invite" />
          <Stack.Screen name="tournaments/[id]" />
          <Stack.Screen name="tournaments/match-score" />
          <Stack.Screen name="tournaments/americano-points" />
        </Stack>
      </SafeAreaProvider>
    </AlertProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 10,
    padding: 16,
  },
  loadingText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
  },
});
