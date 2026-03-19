import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button, Input } from '@/components';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { getPostAuthRoute } from '@/utils/authRedirect';

const supabase = getSupabaseClient();

export default function VerifyCodeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    setError(null);

    if (!code.trim()) {
      setError('Verification code is required');
      return;
    }

    if (code.trim().length !== 4) {
      setError('Code must be 4 digits');
      return;
    }

    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: code.trim(),
        type: 'email',
      });

      if (verifyError) {
        console.error('Verify Error:', verifyError);
        if (verifyError.message.includes('expired')) {
          setError('Code expired. Please request a new one');
        } else if (verifyError.message.includes('invalid')) {
          setError('Invalid code. Please check and try again');
        } else {
          setError(verifyError.message || 'Verification failed');
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Verification failed. Please try again');
        setLoading(false);
        return;
      }

      const postAuthRoute = await getPostAuthRoute(data.user.id);
      router.replace(postAuthRoute);
    } catch (err: any) {
      console.error('Verify error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError(null);
    setLoading(true);

    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (resendError) {
        console.error('Resend Error:', resendError);
        setError(resendError.message || 'Failed to resend code');
      } else {
        setResendCooldown(60);
        setCode('');
      }
    } catch (err: any) {
      console.error('Resend error:', err);
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>📧</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 4-digit code to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Verification Code"
            value={code}
            onChangeText={(text) => {
              // Only allow digits
              const cleaned = text.replace(/\D/g, '');
              setCode(cleaned);
              setError(null);
            }}
            placeholder="0000"
            keyboardType="number-pad"
            maxLength={4}
            error={error}
            autoFocus
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            title={loading ? 'Verifying...' : 'Verify'}
            onPress={handleVerify}
            fullWidth
            disabled={loading || code.length !== 4}
          />

          <View style={styles.actions}>
            <Pressable onPress={handleChangeEmail} disabled={loading}>
              <Text style={styles.actionText}>Change email</Text>
            </Pressable>

            <Text style={styles.separator}>•</Text>

            <Pressable onPress={handleResend} disabled={loading || resendCooldown > 0}>
              <Text
                style={[
                  styles.actionText,
                  (loading || resendCooldown > 0) && styles.actionTextDisabled,
                ]}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </Text>
            </Pressable>
          </View>
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
  icon: {
    fontSize: 64,
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
    lineHeight: 24,
  },
  emailText: {
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  form: {
    gap: Spacing.lg,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  actionTextDisabled: {
    color: Colors.textDisabled,
  },
  separator: {
    fontSize: Typography.sizes.sm,
    color: Colors.textMuted,
  },
});
