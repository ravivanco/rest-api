import { z } from 'zod';

const TIPOS_ALERTA = [
  'adherencia', 'peso', 'consumo_adicional', 'inactividad', 'exceso_calorico'
] as const;

const SEVERIDADES_ALERTA = ['normal', 'critica'] as const;

export const ListAlertsDto = z.object({
  tipo:     z.enum(TIPOS_ALERTA).optional(),
  severidad: z.enum(SEVERIDADES_ALERTA).optional(),
  revisada: z.enum(['true', 'false']).optional(),
  page:     z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit:    z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListAlertsDto = z.infer<typeof ListAlertsDto>;

export const CreateAlertDto = z.object({
  id_perfil:       z.number().int().positive(),
  id_nutricionista: z.number().int().positive().nullable().optional(),
  tipo:            z.enum(TIPOS_ALERTA),
  severidad:       z.enum(SEVERIDADES_ALERTA).nullable().optional(),
  mensaje:         z.string().min(5).max(500),
  fecha_alerta:    z.string().optional(),
  datos:           z.record(z.unknown()).optional(),
});
export type CreateAlertDto = z.infer<typeof CreateAlertDto>;
