import { z } from 'zod';

/**
 * Filtros para listar pacientes (plataforma web - nutricionista).
 * Todos son opcionales — sin filtros retorna todos los pacientes.
 */
export const ListPatientsDto = z.object({
  search:               z.string().optional(),
  estado_plan:          z.enum(['pendiente','activo','suspendido','finalizado']).optional(),
  adherencia:           z.enum(['alto','medio','bajo']).optional(),
  formulario_completado: z.enum(['true','false']).optional(),
  page:                 z.string().optional().transform(v => parseInt(v ?? '1') || 1),
  limit:                z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});

export type ListPatientsDto = z.infer<typeof ListPatientsDto>;