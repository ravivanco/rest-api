import { z } from 'zod';

/**
 * DTO para marcar un ejercicio como completado o no completado.
 */
export const TrackExerciseDto = z.object({
  id_ejercicio_diario: z
    .number({ message: 'El ID del ejercicio diario es requerido' })
    .int()
    .positive(),

  completado: z
    .boolean({ message: 'El campo completado es requerido' }),

  hora_registro: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido. Usa HH:MM')
    .optional()
    .nullable(),
});
export type TrackExerciseDto = z.infer<typeof TrackExerciseDto>;