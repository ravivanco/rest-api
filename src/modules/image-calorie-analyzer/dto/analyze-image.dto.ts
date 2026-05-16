// ─── DTO de entrada ───────────────────────────────────────────────────────────

export interface AnalyzeImageDto {
  /** Opción A: imagen en base64 (desde la app móvil — recomendado) */
  imagen_base64?: string;

  /** Opción B: URL de imagen (desde la web o Cloudinary) */
  imagen_url?: string;

  /** Descripción opcional que escribe el paciente ("arroz con pollo", etc.) */
  descripcion_alimento?: string;
}

// ─── Tipos del resultado ─────────────────────────────────────────────────────

export interface AlimentoDetectado {
  nombre:     string;
  cantidad_g: number | null;
  calorias:   number;
}

export interface MacrosResult {
  proteinas_g:     number | null;
  carbohidratos_g: number | null;
  grasas_g:        number | null;
}

// ─── DTO de resultado ─────────────────────────────────────────────────────────

export interface ImageCaloriesResult {
  /** Calorías totales estimadas del plato. null si no se puede estimar. */
  calorias_estimadas:   number | null;

  /** Peso total estimado en gramos. */
  porcion_estimada_g:   number | null;

  /** Nivel de confianza del modelo (0–100). */
  confianza_pct:        number | null;

  /** Fuente del análisis. */
  fuente_estimacion:    'manual' | 'ia_vision' | 'heuristica' | 'pendiente';

  /** Etiquetas detectadas por Google Vision. */
  etiquetas_detectadas: string[];

  /** Texto OCR detectado en la imagen. */
  texto_detectado:      string | null;

  /** Lista de cada alimento identificado por Gemini. */
  alimentos_detectados: AlimentoDetectado[];

  /** Macronutrientes totales estimados del plato. */
  macros:               MacrosResult;

  /** Mensaje explicativo para el paciente (en español). */
  mensaje:              string;

  /** URL de la imagen si fue procesada. */
  imagen_url?:          string | null;
  /** Formato extendido compatible con Gemini Vision */
  foods?: Array<{
    name: string;
    quantity_g: number | null;
    calories_kcal: number | null;
    macros?: { protein_g?: number | null; carbs_g?: number | null; fats_g?: number | null };
    confidence_pct?: number | null;
  }>;
  totals?: { calories_kcal: number | null; protein_g?: number | null; carbs_g?: number | null; fats_g?: number | null };
  health_score?: number | null;
  recommendation?: string | null;
}