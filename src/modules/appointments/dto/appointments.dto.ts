import { z } from 'zod';

const ESTADOS_VALIDOS = ['programada', 'atendida', 'cancelada', 'reprogramada'] as const;

/**
 * DTO para crear una cita nueva.
 */
export const CreateAppointmentDto = z.object({

  id_perfil: z
    .number({ required_error: 'El ID del perfil del paciente es requerido' })
    .int()
    .positive(),

  fecha_hora: z
    .string({ required_error: 'La fecha y hora son requeridas' })
    .refine(val => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, 'Formato de fecha y hora inválido. Usa ISO 8601. Ej: 2026-04-15T10:00:00')
    .refine(val => {
      const date = new Date(val);
      return date > new Date();
    }, 'La cita debe ser en una fecha futura'),

  notas: z
    .string()
    .max(1000, 'Las notas no pueden superar 1000 caracteres')
    .optional()
    .nullable(),
});
export type CreateAppointmentDto = z.infer<typeof CreateAppointmentDto>;


/**
 * DTO para actualizar una cita (fecha, hora o notas).
 */
export const UpdateAppointmentDto = z.object({

  fecha_hora: z
    .string()
    .refine(val => !isNaN(new Date(val).getTime()), 'Formato de fecha y hora inválido')
    .refine(val => new Date(val) > new Date(), 'La cita debe ser en una fecha futura')
    .optional(),

  notas: z
    .string()
    .max(1000, 'Las notas no pueden superar 1000 caracteres')
    .optional()
    .nullable(),
});
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentDto>;


/**
 * DTO para cambiar el estado de una cita.
 */
export const ChangeStatusDto = z.object({
  estado: z.enum([...ESTADOS_VALIDOS] as [string, ...string[]], {
    message: `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`,
  }),

  notas: z
    .string()
    .max(500, 'Las notas no pueden superar 500 caracteres')
    .optional()
    .nullable(),
});
export type ChangeStatusDto = z.infer<typeof ChangeStatusDto>;


/**
 * DTO para vincular una evaluación clínica a una cita.
 */
export const LinkEvaluationDto = z.object({
  id_evaluacion: z
    .number({ required_error: 'El ID de la evaluación es requerido' })
    .int()
    .positive(),
});
export type LinkEvaluationDto = z.infer<typeof LinkEvaluationDto>;


/**
 * Filtros para listar citas.
 */
export const ListAppointmentsDto = z.object({
  id_perfil:  z.string().optional().transform(v => v ? parseInt(v) : undefined),
  estado:     z.enum(ESTADOS_VALIDOS).optional(),
  desde:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD').optional(),
  hasta:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD').optional(),
  page:       z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit:      z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListAppointmentsDto = z.infer<typeof ListAppointmentsDto>;