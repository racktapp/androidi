
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/constants/theme';
import { Button, Input, LoadingSpinner } from '@/components';
import { tournamentsService } from '@/services/tournaments';
import { Sport } from '@/constants/config';

export default function CreateTournamentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<Sport>('tennis');
  const [type, setType] = useState<'americano' | 'normal'>('americano');
  const [mode, setMode] = useState<'singles' | 'doubles'>('singles');
  const [isCompetitive, setIsCompetitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a tournament title');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const tournament = await tournamentsService.createTournament({
        title: title.trim(),
        sport,
        type,
        format: type === 'normal' ? 'groups_playoffs' : undefined,
        mode,
        isCompetitive,
      });

      router.replace(`/tournaments/${tournament.id}`);
    } catch (err: any) {
      console.error('Error creating tournament:', err);
      setError(err.message || 'Failed to create tournament');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Tournament</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Tournament Name</Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Summer Championship 2024"
            autoCapitalize="words"
          />
        </View>

        {/* Sport */}
        <View style={styles.section}>
          <Text style={styles.label}>Sport</Text>
          <View style={styles.optionsRow}>
            <Pressable
              style={[styles.sportChip, sport === 'tennis' && styles.sportChipSelected]}
              onPress={() => setSport('tennis')}
            >
              <Image
                source={require('@/assets/icons/tennis_icon.png')}
                style={[
                  styles.sportIcon,
                  sport !== 'tennis' && styles.sportIconInactive,
                ]}
                contentFit="contain"
                transition={0}
              />
              <Text style={[styles.sportChipText, sport === 'tennis' && styles.sportChipTextSelected]}>
                Tennis
              </Text>
            </Pressable>
            <Pressable
              style={[styles.sportChip, sport === 'padel' && styles.sportChipSelected]}
              onPress={() => setSport('padel')}
            >
              <Image
                source={require('@/assets/icons/padel_icon.png')}
                style={[
                  styles.sportIcon,
                  sport !== 'padel' && styles.sportIconInactive,
                ]}
                contentFit="contain"
                transition={0}
              />
              <Text style={[styles.sportChipText, sport === 'padel' && styles.sportChipTextSelected]}>
                Padel
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Tournament Type</Text>
          <View style={styles.typeCards}>
            <Pressable
              style={[styles.typeCard, type === 'americano' && styles.typeCardSelected]}
              onPress={() => setType('americano')}
            >
              <Text style={[styles.typeCardTitle, type === 'americano' && styles.typeCardTitleSelected]}>
                Americano
              </Text>
              <Text style={[styles.typeCardHelper, type === 'americano' && styles.typeCardHelperSelected]}>
                Rotating partners
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeCard, type === 'normal' && styles.typeCardSelected]}
              onPress={() => setType('normal')}
            >
              <Text style={[styles.typeCardTitle, type === 'normal' && styles.typeCardTitleSelected]}>
                Normal
              </Text>
              <Text style={[styles.typeCardHelper, type === 'normal' && styles.typeCardHelperSelected]}>
                Fixed teams
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Mode */}
        <View style={styles.section}>
          <Text style={styles.label}>Match Format</Text>
          <View style={styles.optionsRow}>
            <Pressable
              style={[styles.chip, mode === 'singles' && styles.chipSelected]}
              onPress={() => setMode('singles')}
            >
              <Text style={[styles.chipText, mode === 'singles' && styles.chipTextSelected]}>
                Singles
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, mode === 'doubles' && styles.chipSelected]}
              onPress={() => setMode('doubles')}
            >
              <Text style={[styles.chipText, mode === 'doubles' && styles.chipTextSelected]}>
                Doubles
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Competitive Toggle */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => setIsCompetitive(!isCompetitive)}
        >
          <View style={styles.toggleInfo}>
            <View style={styles.toggleTitleRow}>
              <MaterialIcons 
                name="star" 
                size={20} 
                color={isCompetitive ? Colors.accentGold : Colors.textMuted} 
              />
              <Text style={styles.toggleTitle}>Competitive Tournament</Text>
            </View>
            <Text style={styles.toggleHelper}>
              {isCompetitive 
                ? 'Final results will affect player ratings' 
                : "Results won't affect ratings"}
            </Text>
          </View>
          <View style={[styles.toggleSwitch, isCompetitive && styles.toggleSwitchActive]}>
            <View style={[styles.toggleThumb, isCompetitive && styles.toggleThumbActive]} />
          </View>
        </Pressable>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Button
          title="Create Tournament"
          onPress={handleCreate}
          fullWidth
          disabled={submitting || !title.trim()}
          icon={submitting ? <LoadingSpinner size={20} /> : undefined}
        />
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
  section: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sportChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sportChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  sportChipTextSelected: {
    fontWeight: Typography.weights.semibold,
  },
  sportIcon: {
    width: 16,
    height: 16,
  },
  sportIconInactive: {
    opacity: 0.5,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textPrimary,
  },
  chipTextSelected: {
    fontWeight: Typography.weights.semibold,
  },
  typeCards: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeCardSelected: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  typeCardTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  typeCardTitleSelected: {
    color: Colors.primary,
  },
  typeCardHelper: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  typeCardHelperSelected: {
    color: Colors.textMuted,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  toggleInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toggleTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textPrimary,
  },
  toggleHelper: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textPrimary,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
});
