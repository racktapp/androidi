import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface StartupErrorScreenProps {
  title?: string;
  message: string;
  stack?: string;
  onRetry?: () => void;
  onReload?: () => void;
}

export function StartupErrorScreen({
  title = 'Something went wrong',
  message,
  stack,
  onRetry,
  onReload,
}: StartupErrorScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {stack ? (
        <ScrollView style={styles.stackContainer}>
          <Text style={styles.stackText}>{stack}</Text>
        </ScrollView>
      ) : null}
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={onRetry}>
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        ) : null}
        {onReload ? (
          <Pressable style={[styles.button, styles.primaryButton]} onPress={onReload}>
            <Text style={styles.primaryButtonText}>Reload</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#f9fafb',
    fontSize: 24,
    fontWeight: '700',
  },
  message: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  stackContainer: {
    maxHeight: 220,
    backgroundColor: '#0b1220',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 10,
  },
  stackText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#64748b',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});
