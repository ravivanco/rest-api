import { z } from 'zod';

/**
 * DTO para registrar una nueva evaluación clínica.
 * Solo acepta datos reales medidos en la evaluación.
 * TMB, GET, calorías objetivo y edad metabólica se calculan en backend.
 */
export const CreateEvaluationDto = z.object({

  id_perfil: z
    .number({ message: 'El ID del perfil del paciente es requerido' })
    .int()
    .positive('El ID del perfil debe ser un número positivo'),

  peso_kg: z
    .number({ message: 'El peso es requerido' })
    .gt(0, 'El peso debe ser mayor a 0')
    .min(20,  'El peso mínimo es 20 kg')
    .max(500, 'El peso máximo es 500 kg')
    .multipleOf(0.01, 'El peso puede tener máximo 2 decimales'),

  altura_cm: z
    .number({ message: 'La altura es requerida' })
    .gt(0, 'La altura debe ser mayor a 0')
    .min(100, 'La altura mínima es 100 cm')
    .max(250, 'La altura máxima es 250 cm')
    .multipleOf(0.1, 'La altura puede tener máximo 1 decimal'),

  porcentaje_grasa: z
    .number()
    .min(0,   'El porcentaje de grasa mínimo es 0%')
    .max(100, 'El porcentaje de grasa máximo es 100%'),

  masa_muscular_kg: z
    .number()
    .min(0,   'La masa muscular mínima es 0 kg')
    .max(200, 'La masa muscular máxima es 200 kg')
    .multipleOf(0.01, 'La masa muscular puede tener máximo 2 decimales'),

  grasa_visceral: z
    .number()
    .min(0, 'La grasa visceral no puede ser negativa')
    .multipleOf(0.01, 'La grasa visceral puede tener máximo 2 decimales'),

  agua_corporal_pct: z
    .number()
    .min(0, 'El agua corporal mínima es 0%')
    .max(100, 'El agua corporal máxima es 100%')
    .multipleOf(0.01, 'El agua corporal puede tener máximo 2 decimales'),

  masa_osea_kg: z
    .number()
    .min(0, 'La masa ósea no puede ser negativa')
    .multipleOf(0.01, 'La masa ósea puede tener máximo 2 decimales'),

  fecha_evaluacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD')
    .optional(),
}).strict('El request contiene campos no permitidos para registrar la evaluación');

export type CreateEvaluationDto = z.infer<typeof CreateEvaluationDto>;


/**
 * DTO para comparar evaluaciones.
 * Recibe los IDs de las dos evaluaciones a comparar.
 */
export const CompareEvaluationsDto = z.object({
  evaluation_ids: z
    .string({ message: 'Los IDs de evaluaciones son requeridos' })
    .refine(val => {
      const ids = val.split(',');
      return ids.length === 2 && ids.every(id => !isNaN(parseInt(id)));
    }, 'Debes enviar exactamente 2 IDs separados por coma. Ej: evaluation_ids=3,7'),
});

export type CompareEvaluationsDto = z.infer<typeof CompareEvaluationsDto>;