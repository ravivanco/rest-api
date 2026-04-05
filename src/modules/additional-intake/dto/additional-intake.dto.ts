import { z } from 'zod';

/**
 * DTO para registrar un consumo adicional.
 * El paciente describe qué comió, opcionalmente sube imagen y estima calorías.
 * Las calorías NO se suman al balance hasta que confirme.
 */
export const CreateAdditionalIntakeDto = z.object({

  descripcion_alimento: z
    .string({ message: 'La descripción del alimento es requerida' })
    .min(3,   'La descripción debe tener al menos 3 caracteres')
    .max(200, 'La descripción no puede superar 200 caracteres')
    .trim(),

  imagen_url: z
    .string()
    .url('El enlace de la imagen debe ser una URL válida')
    .optional()
    .nullable(),

  // El paciente puede ingresar las calorías manualmente
  // Si no las ingresa, quedan pendientes de estimación
  calorias_estimadas: z
    .number()
    .int('Las calorías deben ser un número entero')
    .min(1,    'Las calorías mínimas son 1 kcal')
    .max(5000, 'Las calorías máximas son 5000 kcal')
    .optional()
    .nullable(),

  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido. Usa HH:MM')
    .optional()
    .nullable(),
});
export type CreateAdditionalIntakeDto = z.infer<typeof CreateAdditionalIntakeDto>;


/**
 * DTO para confirmar un consumo adicional y sumarlo al balance calórico.
 * Se puede ajustar la estimación de calorías antes de confirmar.
 */
export const ConfirmIntakeDto = z.object({
  calorias_estimadas: z
    .number({ message: 'Las calorías estimadas son requeridas para confirmar' })
    .int()
    .min(1,    'Las calorías mínimas son 1 kcal')
    .max(5000, 'Las calorías máximas son 5000 kcal'),
});
export type ConfirmIntakeDto = z.infer<typeof ConfirmIntakeDto>;


/**
 * Filtros para listar consumos adicionales (web - nutricionista).
 */
export const ListIntakeDto = z.object({
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD')
    .optional(),

  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Usa YYYY-MM-DD')
    .optional(),

  confirmado: z.enum(['true', 'false']).optional(),

  page:  z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit: z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListIntakeDto = z.infer<typeof ListIntakeDto>;