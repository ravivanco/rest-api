import { z } from 'zod';

/**
 * Valores permitidos para deportes.
 * Sincronizados con el CHECK constraint en actividades_fisicas_intereses.deporte
 * Corrección aplicada: BD v2.0
 */
const DEPORTES_VALIDOS = [
  'gimnasio',
  'running',
  'caminata',
  'ciclismo',
  'futbol',
  'basquet',
  'natacion',
  'entrenamiento_casa',
  'otro',
  'ninguno',
] as const;

export type DeporteValido = typeof DEPORTES_VALIDOS[number];

/**
 * DTO para guardar o actualizar el formulario inicial del paciente.
 * La app móvil puede enviarlo completo o en partes.
 * Cuando todos los campos requeridos están presentes, se marca completado.
 */
export const SaveProfileFormDto = z.object({

  nivel_actividad_fisica: z.enum(
    ['sedentario', 'bajo', 'medio', 'alto'] as const,
    { message: 'El nivel de actividad física es requerido' }
  ),

  objetivo: z
    .string({ message: 'El objetivo es requerido' })
    .min(3,   'El objetivo debe tener al menos 3 caracteres')
    .max(120, 'El objetivo no puede superar 120 caracteres'),

  alergias_intolerancias: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional()
    .nullable(),

  restricciones_alimenticias: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional()
    .nullable(),

  // IDs de condiciones médicas del catálogo
  condiciones: z
    .array(z.number().int().positive())
    .optional()
    .default([]),

  // IDs de alimentos preferidos
  alimentos_preferidos: z
    .array(z.number().int().positive())
    .optional()
    .default([]),

  // IDs de alimentos restringidos
  alimentos_restringidos: z
    .array(z.number().int().positive())
    .optional()
    .default([]),

  // Nombres de deportes de interés
  deportes: z
    .array(
      z.enum(DEPORTES_VALIDOS, {
        errorMap: () => ({
          message: `Deporte inválido. Valores permitidos: ${DEPORTES_VALIDOS.join(', ')}`,
        }),
      })
    )
    .optional()
    .default([]),
});

export type SaveProfileFormDto = z.infer<typeof SaveProfileFormDto>;


/**
 * DTO para agregar una condición médica individual.
 */
export const AddCondicionDto = z.object({
  id_condicion: z
    .number({ message: 'El ID de la condición es requerido' })
    .int()
    .positive(),
});

export type AddCondicionDto = z.infer<typeof AddCondicionDto>;


/**
 * DTO para agregar una preferencia alimenticia.
 */
export const AddPreferenciaDto = z.object({
  id_alimento: z
    .number({ message: 'El ID del alimento es requerido' })
    .int()
    .positive(),

  tipo: z.enum(['preferido', 'restringido'] as const, {
    message: "El tipo debe ser 'preferido' o 'restringido'",
  }),
});

export type AddPreferenciaDto = z.infer<typeof AddPreferenciaDto>;


/**
 * DTO para agregar un deporte de interés.
 */
export const AddDeporteDto = z.object({
  deporte: z
    .string({ message: 'El nombre del deporte es requerido' })
    .min(2,  'El deporte debe tener al menos 2 caracteres')
    .max(60, 'El deporte no puede superar 60 caracteres')
    .trim(),
});

export type AddDeporteDto = z.infer<typeof AddDeporteDto>;