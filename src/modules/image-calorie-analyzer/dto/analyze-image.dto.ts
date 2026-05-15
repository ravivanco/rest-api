export interface AnalyzeImageDto {
  imagen_url: string;
  descripcion_alimento?: string;
}

export interface ImageCaloriesResult {
  calorias_estimadas: number | null;
  confianza_pct: number | null;
  porcion_estimada_g: number | null;
  fuente_estimacion: 'manual' | 'ia_vision' | 'pendiente';
  etiquetas_detectadas: string[];
  texto_detectado: string | null;
  mensaje: string;
}
