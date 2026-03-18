import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { Sport, MatchFormat, MatchType } from '@/constants/config';
import { UserAvatar } from '@/components';
import { getUserLabel } from '@/utils/getUserLabel';

export interface PosterData {
  sport: Sport;
  format: MatchFormat;
  matchType: MatchType;
  groupName?: string | null; // Optional for standalone 1v1 matches
  teamAName: string;
  teamBName: string;
  teamAHandle?: string;
  teamBHandle?: string;
  teamAAvatar?: string | null;
  teamBAvatar?: string | null;
  sets: Array<{ a: number; b: number }>;
  winnerSide: 'A' | 'B';
  finalSetsWonA: number;
  finalSetsWonB: number;
  createdByName?: string;
}

interface MatchPosterProps {
  data: PosterData;
  size?: 'preview' | 'full';
}

export const MatchPoster = React.forwardRef<View, MatchPosterProps>(
  ({ data, size = 'preview' }, ref) => {
    const isPreview = size === 'preview';
    const scale = isPreview ? 0.4 : 1;

    const containerWidth = 1080 * scale;
    const containerHeight = 1920 * scale;

    const winnerName = data.winnerSide === 'A' ? data.teamAName : data.teamBName;
    const setsWonText = `${data.finalSetsWonA} – ${data.finalSetsWonB}`;

    return (
      <View
        ref={ref}
        style={[
          styles.container,
          {
            width: containerWidth,
            height: containerHeight,
          },
        ]}
      >
        {/* Background */}
        <Image
          source={require('@/assets/images/poster-background.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerText, { fontSize: 18 * scale }]}>
              {data.sport.toUpperCase()} • {data.format.toUpperCase()}
            </Text>
            {data.groupName && (
              <Text style={[styles.groupText, { fontSize: 14 * scale }]}>
                {data.groupName}
              </Text>
            )}
          </View>

          {/* Main Matchup */}
          <View style={styles.matchupSection}>
            {/* Team A */}
            <View style={styles.teamSide}>
              <View style={{ transform: [{ scale }] }}>
                <UserAvatar
                  name={data.teamAName}
                  avatarUrl={data.teamAAvatar}
                  size={64}
                />
              </View>
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text
                  style={[styles.teamName, { fontSize: 24 * scale }]}
                  numberOfLines={1}
                >
                  {data.teamAName}
                </Text>
                {data.teamAHandle && (
                  <Text
                    style={[styles.teamHandle, { fontSize: 14 * scale }]}
                    numberOfLines={1}
                  >
                    {data.teamAHandle}
                  </Text>
                )}
              </View>
            </View>

            {/* VS */}
            <View style={styles.vsSection}>
              <View
                style={[
                  styles.glowLine,
                  { width: 100 * scale, height: 2 * scale },
                ]}
              />
              <Text style={[styles.vsText, { fontSize: 48 * scale }]}>VS</Text>
              <View
                style={[
                  styles.glowLine,
                  { width: 100 * scale, height: 2 * scale },
                ]}
              />
            </View>

            {/* Team B */}
            <View style={styles.teamSide}>
              <View style={{ transform: [{ scale }] }}>
                <UserAvatar
                  name={data.teamBName}
                  avatarUrl={data.teamBAvatar}
                  size={64}
                />
              </View>
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text
                  style={[styles.teamName, { fontSize: 24 * scale }]}
                  numberOfLines={1}
                >
                  {data.teamBName}
                </Text>
                {data.teamBHandle && (
                  <Text
                    style={[styles.teamHandle, { fontSize: 14 * scale }]}
                    numberOfLines={1}
                  >
                    {data.teamBHandle}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Set Scores Table */}
          <View
            style={[
              styles.setsTable,
              {
                paddingHorizontal: 32 * scale,
                paddingVertical: 24 * scale,
                borderRadius: 16 * scale,
                marginTop: 40 * scale,
              },
            ]}
          >
            {data.sets.map((set, index) => (
              <View
                key={index}
                style={[
                  styles.setRow,
                  { paddingVertical: 12 * scale },
                  index < data.sets.length - 1 && styles.setRowBorder,
                ]}
              >
                <Text style={[styles.setLabel, { fontSize: 18 * scale }]}>
                  Set {index + 1}
                </Text>
                <View style={styles.setScores}>
                  <Text style={[styles.setScore, { fontSize: 28 * scale }]}>
                    {set.a}
                  </Text>
                  <Text
                    style={[
                      styles.setDivider,
                      { fontSize: 24 * scale, marginHorizontal: 16 * scale },
                    ]}
                  >
                    -
                  </Text>
                  <Text style={[styles.setScore, { fontSize: 28 * scale }]}>
                    {set.b}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Winner Headline */}
          <View style={[styles.winnerSection, { marginTop: 48 * scale }]}>
            <Text
              style={[styles.winnerText, { fontSize: 40 * scale }]}
              numberOfLines={1}
            >
              {winnerName} wins {setsWonText}
            </Text>
          </View>

          {/* Match Type Label */}
          <View
            style={[
              styles.matchTypeLabel,
              {
                paddingHorizontal: 24 * scale,
                paddingVertical: 10 * scale,
                borderRadius: 20 * scale,
                marginTop: 32 * scale,
              },
            ]}
          >
            <Text style={[styles.matchTypeText, { fontSize: 16 * scale }]}>
              {data.matchType.toUpperCase()} MATCH
            </Text>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { marginTop: 60 * scale }]}>
            <View style={styles.brandSection}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={{
                  width: 50 * scale,
                  height: 50 * scale,
                }}
                contentFit="contain"
                transition={200}
              />
              <View style={styles.brandText}>
                <Text style={[styles.brandName, { fontSize: 24 * scale }]}>
                  rackt
                </Text>
                <Text style={[styles.brandTagline, { fontSize: 12 * scale }]}>
                  Track your racket sports matches
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 60,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  headerText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  groupText: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  matchupSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  teamSide: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },

  teamName: {
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamHandle: {
    color: Colors.textMuted,
    fontWeight: '400',
    textAlign: 'center',
  },
  vsSection: {
    alignItems: 'center',
    gap: 16,
  },
  glowLine: {
    backgroundColor: Colors.accentGold,
    shadowColor: Colors.accentGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  vsText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textShadowColor: Colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  setsTable: {
    backgroundColor: 'rgba(14, 23, 48, 0.8)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  setLabel: {
    color: Colors.textMuted,
    fontWeight: '500',
  },
  setScores: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setScore: {
    color: Colors.textPrimary,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  setDivider: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
  winnerSection: {
    alignItems: 'center',
  },
  winnerText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  matchTypeLabel: {
    backgroundColor: `${Colors.accentGold}15`,
    borderWidth: 1,
    borderColor: Colors.accentGold,
    alignSelf: 'center',
  },
  matchTypeText: {
    color: Colors.accentGold,
    fontWeight: '600',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  brandText: {
    gap: 4,
  },
  brandName: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  brandTagline: {
    color: Colors.textMuted,
    fontWeight: '400',
  },
  noScoreContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noScoreText: {
    color: Colors.textMuted,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
