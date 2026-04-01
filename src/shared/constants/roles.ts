export const ROLES = {
  PATIENT: 'paciente',
  NUTRITIONIST: 'nutricionista',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];