import { z } from 'zod';

/**
 * DTO para crear un plan nutricional nuevo.
 * Se vincula a una evaluación clínica existente.
 */
export const CreatePlanDto = z.object({
  id_evaluacion: z
    .number({ error: 'El ID de la evaluación es requerido' })
    .int()
    .positive(),

  notas: z
    .string()
    .max(1000, 'Las notas no pueden superar 1000 caracteres')
    .optional()
    .nullable(),
});
export type CreatePlanDto = z.infer<typeof CreatePlanDto>;


/**
 * DTO para activar un plan con su fecha de inicio.
 * Al activar: estado → activo, modulo_habilitado → true.
 */
export const ActivatePlanDto = z.object({
  fecha_inicio: z
    .string({ error: 'La fecha de inicio es requerida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD'),

  fecha_fin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD')
    .optional()
    .nullable(),
});
export type ActivatePlanDto = z.infer<typeof ActivatePlanDto>;


/**
 * DTO para crear una semana dentro del plan.
 */
export const CreateWeekDto = z.object({
  numero: z
    .number({ error: 'El número de semana es requerido' })
    .int()
    .min(1, 'El número de semana mínimo es 1'),

  fecha_inicio_semana: z
    .string({ error: 'La fecha de inicio de la semana es requerida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD'),

  fecha_fin_semana: z
    .string({ error: 'La fecha de fin de la semana es requerida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD'),
});
export type CreateWeekDto = z.infer<typeof CreateWeekDto>;


/**
 * DTO para asignar un menú a un día y tiempo de comida.
 */
export const CreateMenuDto = z.object({
  id_tiempo_comida: z
    .number({ error: 'El tiempo de comida es requerido' })
    .int()
    .min(1).max(5),

  id_plato: z
    .number({ error: 'El plato es requerido' })
    .int()
    .positive(),

  calorias_aportadas: z
    .number({ error: 'Las calorías aportadas son requeridas' })
    .int()
    .min(0,    'Las calorías no pueden ser negativas')
    .max(5000, 'Las calorías no pueden superar 5000 por menú'),
});
export type CreateMenuDto = z.infer<typeof CreateMenuDto>;


/**
 * DTO para asignar un ejercicio a un día del plan.
 */
export const CreateDailyExerciseDto = z.object({
  id_ejercicio: z
    .number({ error: 'El ID del ejercicio es requerido' })
    .int()
    .positive(),
});
export type CreateDailyExerciseDto = z.infer<typeof CreateDailyExerciseDto>;