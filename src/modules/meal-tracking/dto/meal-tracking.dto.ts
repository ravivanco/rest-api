import { z } from 'zod';

/**
 * DTO para marcar una comida como realizada o no realizada.
 */
export const TrackMealDto = z.object({
  id_menu_diario: z
    .union([z.number(), z.string()], { message: 'El ID del menú diario es requerido' }),


  realizado: z
    .boolean({ message: 'El campo realizado es requerido' }),

  hora_registro: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido. Usa HH:MM')
    .optional()
    .nullable(),
});
export type TrackMealDto = z.infer<typeof TrackMealDto>;