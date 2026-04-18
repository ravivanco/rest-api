import { z } from 'zod';

const INTENSIDADES       = ['baja', 'media', 'alta'] as const;
const NIVELES_ACTIVIDAD  = ['sedentario', 'bajo', 'medio', 'alto'] as const;

/**
 * DTO para crear o actualizar un ejercicio.
 */
export const CreateExerciseDto = z.object({
  nombre: z
    .string({ message: 'El nombre es requerido' })
    .min(2,   'El nombre debe tener al menos 2 caracteres')
    .max(150, 'Máximo 150 caracteres')
    .trim(),

  descripcion: z
    .string()
    .max(2000, 'Máximo 2000 caracteres')
    .optional()
    .nullable(),

  categoria: z
    .string({ message: 'La categoría es requerida' })
    .min(2)
    .max(60)
    .trim(),

  duracion_min: z
    .number({ message: 'La duración es requerida' })
    .int()
    .min(1,    'La duración mínima es 1 minuto')
    .max(480,  'La duración máxima es 480 minutos (8 horas)'),

  frecuencia_semanal: z
    .number({ message: 'La frecuencia semanal es requerida' })
    .int()
    .min(1, 'La frecuencia mínima es 1 día por semana')
    .max(7, 'La frecuencia máxima es 7 días por semana'),

  intensidad: z.enum(INTENSIDADES, {
    message: 'La intensidad es requerida',
  }),

  nivel_actividad_recomendado: z
    .enum(NIVELES_ACTIVIDAD)
    .optional()
    .nullable(),

  objetivo_recomendado: z
    .string()
    .max(80)
    .optional()
    .nullable(),

  imagen_url: z
    .string()
    .url('La URL de la imagen no es válida')
    .optional()
    .nullable(),

  imagen_public_id: z
    .string()
    .optional()
    .nullable(),
});
export type CreateExerciseDto = z.infer<typeof CreateExerciseDto>;

export const UpdateExerciseDto = CreateExerciseDto.partial();
export type UpdateExerciseDto = z.infer<typeof UpdateExerciseDto>;

/**
 * Filtros para listar ejercicios.
 */
export const ListExercisesDto = z.object({
  search:                     z.string().optional(),
  intensidad:                 z.enum(INTENSIDADES).optional(),
  nivel_actividad_recomendado: z.enum(NIVELES_ACTIVIDAD).optional(),
  categoria:                  z.string().optional(),
  activo:                     z.enum(['true', 'false']).optional(),
  page:  z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListExercisesDto = z.infer<typeof ListExercisesDto>;