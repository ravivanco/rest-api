import { z } from 'zod';

export const ReviewSuggestionSchema = z.object({
  accion: z.enum(['aprobar', 'rechazar'], {
    message: 'La accion debe ser aprobar o rechazar',
  }),
  id_nutricionista: z
    .number({ message: 'El id_nutricionista es requerido' })
    .int('El id_nutricionista debe ser un entero')
    .positive('El id_nutricionista debe ser positivo'),
});

export type ReviewSuggestionDto = z.infer<typeof ReviewSuggestionSchema>;

export const SuggestionFiltersSchema = z.object({
  estado: z.enum(['pendiente', 'aprobada', 'rechazada']).optional().default('pendiente'),
  id_perfil: z.coerce.number().int().positive().optional(),
  id_plan: z.coerce.number().int().positive().optional(),
});

export type SuggestionFiltersDto = z.infer<typeof SuggestionFiltersSchema>;

export interface SuggestionListItem {
  id_sugerencia: number;
  motivo: string;
  estado: string;
  created_at: string;
  menu_actual: {
    id_menu_diario: number;
    fecha: string;
    tiempo_comida: string;
    plato_actual: {
      id_plato: number;
      nombre: string;
      calorias_totales: number;
    };
  };
  plato_sugerido: {
    id_plato: number;
    nombre: string;
    calorias_totales: number;
  };
}

export interface SuggestionReviewResult {
  id_sugerencia: number;
  estado: 'aprobada' | 'rechazada';
  id_menu_diario: number;
  replacement?: {
    id_menu_diario: number;
    id_plato_anterior: number;
    id_plato_nuevo: number;
    calorias_anteriores: number;
    calorias_nuevas: number;
    nombre_plato_nuevo: string;
  };
}
