export const Sport = {
  TENNIS: 'tennis' as const,
  PADEL: 'padel' as const,
};

export const MatchFormat = {
  SINGLES: 'singles' as const,
  DOUBLES: 'doubles' as const,
};

export const MatchType = {
  FRIENDLY: 'friendly' as const,
  COMPETITIVE: 'competitive' as const,
};

export type Sport = 'tennis' | 'padel';
export type MatchFormat = 'singles' | 'doubles';
export type MatchType = 'friendly' | 'competitive';

export const Config = {
  sports: ['tennis', 'padel'] as Sport[],
  matchFormats: ['singles', 'doubles'] as MatchFormat[],
  matchTypes: ['friendly', 'competitive'] as MatchType[],
  
  rating: {
    min: 0.0,
    max: 7.0,
    initialReliability: 0.20,
    reliabilityIncrement: 0.04,
    maxReliability: 0.90,
    onboardingMax: 4.5,
  },

  onboardingLevels: {
    beginner: 1.0,
    intermediate: 2.5,
    advanced: 3.8,
    adjustment: 0.5,
  },
};
