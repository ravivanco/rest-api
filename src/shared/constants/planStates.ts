export const PLAN_STATES = {
  PENDING: 'pendiente',
  ACTIVE: 'activo',
  SUSPENDED: 'suspendido',
  FINISHED: 'finalizado',
} as const;

export type PlanState = typeof PLAN_STATES[keyof typeof PLAN_STATES];