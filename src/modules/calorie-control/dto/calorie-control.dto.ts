import { z } from 'zod';

/**
 * Filtros para consultar historial de control calórico.
 */
export const CalorieHistoryDto = z.object({
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD')
    .optional(),

  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD')
    .optional(),

  page:  z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '30') || 30, 90)),
});
export type CalorieHistoryDto = z.infer<typeof CalorieHistoryDto>;