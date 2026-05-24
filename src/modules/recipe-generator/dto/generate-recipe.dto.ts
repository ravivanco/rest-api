export type TiempoComidaNombre =
  | 'desayuno'
  | 'media_manana'
  | 'almuerzo'
  | 'media_tarde'
  | 'cena';

export interface GenerateRecipeDto {
  id_perfil: number;
  id_evaluacion: number;
  id_tiempo_comida: number;
  tiempo_comida_nombre: TiempoComidaNombre;
  calorias_objetivo?: number;
  id_dia_plan?: number;
  forzar_cache?: boolean;
}

export interface GenerateGenericDto {
  id_tiempo_comida: number;
  tiempo_comida_nombre: TiempoComidaNombre;
  calorias_objetivo: number;
  restricciones?: string[];
  aptitudes?: number[];
}

export interface RecipeGptIngredient {
  id_alimento_detalle: number;
  cantidad_g: number;
}

export interface RecipeGptResponse {
  nombre: string;
  descripcion?: string | null;
  tiempo_preparacion_min?: number | null;
  modo_preparacion: string;
  ingredientes: RecipeGptIngredient[];
}

export interface GeneratedRecipeResult {
  id_plato: number;
  nombre: string;
  descripcion: string | null;
  calorias_totales: number;
  tiempo_preparacion_min: number | null;
  ingredientes: Array<{
    id_alimento_detalle?: number | null;
    id_alimento?: number | null;
    nombre: string;
    cantidad_g: number;
    calorias_aportadas: number;
  }>;
  guardado_en_menu: boolean;
  id_menu_diario: number | null;
  uso_gpt: boolean;
}

export interface GenerateWeekDto {
  id_plan: number;
  id_semana: number;
  id_evaluacion: number;
  regenerar?: boolean;
}

export interface MenuDiarioSlot {
  id_menu_diario: number;
  id_tiempo_comida: number;
  tiempo_comida: string;
  id_plato: number;
  nombre_plato: string;
  calorias_aportadas: number;
  es_nuevo: boolean;
}

export interface DiaPlanResult {
  id_dia_plan: number;
  dia_semana: string;
  fecha: string;
  menus: MenuDiarioSlot[];
}

export interface GenerateWeekResult {
  id_semana: number;
  semana_numero: number;
  fecha_inicio: string;
  fecha_fin: string;
  dias: DiaPlanResult[];
  resumen: {
    total_slots: number;
    slots_reutilizados: number;
    slots_generados: number;
    llamadas_gpt: number;
  };
}
