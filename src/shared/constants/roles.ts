export const ROLES = {
  PATIENT: 'paciente',
  NUTRITIONIST: 'nutricionista',
  ADMINISTRATOR: 'administrador',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];