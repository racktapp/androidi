import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { Button, Input } from '@/components';
import { Colors, Typography, Spacing } from '@/constants/theme';

const supabase = getSupabaseClient();

export default function EmailAuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendCode = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        console.error('OTP Error:', otpError);
        setError(otpError.message || 'Failed to send code');
        setLoading(false);
        return;
      }

      // Navigate to code verification screen
      router.push({
        pathname: '/auth/verify',
        params: { email: email.trim().toLowerCase() },
      });
    } catch (err: any) {
      console.error('Send code error:', err);
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };



  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
          <Text style={styles.title}>Welcome to Rackt</Text>
          <Text style={styles.subtitle}>Sign in with your email</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email Address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={loading ? 'Sending...' : 'Send Code'}
            onPress={handleSendCode}
            fullWidth
            disabled={loading}
          />

          <Text style={styles.helperText}>
            We will send a 4-digit verification code to your email
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: Typography.weights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  form: {
    gap: Spacing.lg,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },

});
