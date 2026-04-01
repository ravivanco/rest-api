export const ADHERENCE_LEVELS = {
  HIGH: 'alto',
  MEDIUM: 'medio',
  LOW: 'bajo',
} as const;

export type AdherenceLevel = typeof ADHERENCE_LEVELS[keyof typeof ADHERENCE_LEVELS];