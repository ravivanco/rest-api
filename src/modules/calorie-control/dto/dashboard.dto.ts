import { z } from 'zod';

export const DashboardQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD')
    .optional()
    .nullable(),
});

export type DashboardQueryDto = z.infer<typeof DashboardQuerySchema>;
