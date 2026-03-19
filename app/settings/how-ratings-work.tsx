import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';

export default function HowRatingsWorkScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>How Ratings Work</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Skill Levels</Text>
          <Text style={styles.paragraph}>
            Your skill level ranges from 0.0 to 7.0, similar to NTRP ratings. Start at 2.5 and improve as you win matches.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ How It Changes</Text>
          <Text style={styles.paragraph}>
            Only <Text style={styles.bold}>confirmed competitive matches</Text> affect your rating:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Win against higher-rated player → bigger gain</Text>
            <Text style={styles.bullet}>• Win against lower-rated player → smaller gain</Text>
            <Text style={styles.bullet}>• Lose to lower-rated player → bigger loss</Text>
            <Text style={styles.bullet}>• Lose to higher-rated player → smaller loss</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Reliability Score</Text>
          <Text style={styles.paragraph}>
            Your reliability score shows how established your rating is. More matches = higher reliability = smaller rating changes.
          </Text>
          <Text style={styles.paragraph}>
            New players have larger rating swings; experienced players&apos; ratings are more stable.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Match Types</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>
              <Text style={styles.bold}>Competitive:</Text> Affects rating, requires opponent confirmation
            </Text>
            <Text style={styles.bullet}>
              <Text style={styles.bold}>Friendly:</Text> Does not affect rating, great for practice
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Confirmation Required</Text>
          <Text style={styles.paragraph}>
            Both players must confirm competitive matches before ratings update. This prevents false reporting.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <MaterialIcons name="lightbulb" size={24} color={Colors.warning} />
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Tip:</Text> Play more matches to stabilize your rating and get accurate skill assessments!
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
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  paragraph: {
    fontSize: Typography.sizes.base,
    lineHeight: 24,
    color: Colors.textMuted,
  },
  bold: {
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  bulletList: {
    gap: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  bullet: {
    fontSize: Typography.sizes.base,
    lineHeight: 24,
    color: Colors.textMuted,
  },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
    color: Colors.textMuted,
  },
});
