import { z } from 'zod';

export const UpdateMenuPlatoSchema = z.object({
  id_plato: z
    .number({ message: 'El id_plato es requerido' })
    .int('El id_plato debe ser un entero')
    .positive('El id_plato debe ser positivo'),
});

export type UpdateMenuPlatoDto = z.infer<typeof UpdateMenuPlatoSchema>;

export interface MenuDiarioDetailResult {
  id_menu_diario: number;
  dia_semana: string;
  fecha: string;
  tiempo_comida: string;
  plato: {
    id_plato: number;
    nombre: string;
    descripcion: string | null;
    calorias_totales: number;
    tiempo_preparacion_min: number | null;
    modo_preparacion: string;
    generado_por_ia: boolean;
    ingredientes: Array<{
      nombre: string;
      cantidad_g: number;
      calorias_aportadas: number;
    }>;
  };
  calorias_aportadas: number;
}

export interface ReplaceMenuPlatoResult {
  id_menu_diario: number;
  id_plato_anterior: number;
  id_plato_nuevo: number;
  calorias_anteriores: number;
  calorias_nuevas: number;
  nombre_plato_nuevo: string;
}
