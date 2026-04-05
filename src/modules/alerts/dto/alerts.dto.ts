import { z } from 'zod';

const TIPOS_ALERTA = [
  'adherencia', 'peso', 'consumo_adicional', 'inactividad', 'exceso_calorico'
] as const;

export const ListAlertsDto = z.object({
  tipo:     z.enum(TIPOS_ALERTA).optional(),
  revisada: z.enum(['true', 'false']).optional(),
  page:     z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit:    z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListAlertsDto = z.infer<typeof ListAlertsDto>;

export const CreateAlertDto = z.object({
  id_perfil:       z.number().int().positive(),
  id_nutricionista: z.number().int().positive(),
  tipo:            z.enum(TIPOS_ALERTA),
  mensaje:         z.string().min(5).max(500),
});
export type CreateAlertDto = z.infer<typeof CreateAlertDto>;