import { z } from 'zod';

/**
 * DTO para registrar el peso diario del paciente.
 */
export const CreateWeightRecordDto = z.object({
  peso_kg: z
    .number({ error: 'El peso es requerido' })
    .min(20,  'El peso mínimo es 20 kg')
    .max(499, 'El peso máximo es 499 kg')
    .multipleOf(0.01, 'El peso puede tener máximo 2 decimales'),
});
export type CreateWeightRecordDto = z.infer<typeof CreateWeightRecordDto>;