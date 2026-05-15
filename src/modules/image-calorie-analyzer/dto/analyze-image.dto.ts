export interface AnalyzeImageDto {
  // Opción A: imagen en base64 (desde la app móvil — recomendado)
  imagen_base64?: string;

  // Opción B: URL de imagen (desde la web — para compatibilidad)
  imagen_url?: string;

  descripcion_alimento?: string;
}

export interface ImageCaloriesResult {
  calorias_estimadas:   number | null;
  confianza_pct:        number | null;
  porcion_estimada_g:   number | null;
  fuente_estimacion:    'manual' | 'ia_vision' | 'pendiente';
  etiquetas_detectadas: string[];
  texto_detectado:      string | null;
  mensaje:              string;
}