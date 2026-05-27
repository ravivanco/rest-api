import { z } from 'zod';

/**
 * DTO para marcar un ejercicio como completado o no completado.
 */
export const TrackExerciseDto = z.object({
  id_ejercicio_diario: z
    .union([z.number(), z.string()], { message: 'El ID del ejercicio diario es requerido' })
    .optional(),

  id_ejercicio: z
    .union([z.number(), z.string()], { message: 'El ID del ejercicio es requerido' })
    .optional(),

  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD')
    .optional(),

  completado: z
    .boolean({ message: 'El campo completado debe ser booleano' })
    .optional()
    .default(true),

  hora_registro: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido. Usa HH:MM')
    .optional()
    .nullable(),
}).refine(data => data.id_ejercicio_diario !== undefined || (data.id_ejercicio !== undefined && data.fecha !== undefined), {
  message: 'Debe proporcionar id_ejercicio_diario, o en su defecto, id_ejercicio y fecha',
  path: ['id_ejercicio_diario'],
});

export type TrackExerciseDto = z.infer<typeof TrackExerciseDto>;