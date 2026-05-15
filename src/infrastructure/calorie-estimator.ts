import { visionClient } from '@config/vision';

export interface CalorieEstimationResult {
  calorias_estimadas: number | null;
  fuente_estimacion: 'manual' | 'ia_vision' | 'pendiente';
  confianza_pct: number | null;
  mensaje: string;
}

export const estimateFromImage = async (
  imageUrl: string,
  descripcion: string,
): Promise<CalorieEstimationResult> => {
  try {
    // Usar labelDetection y textDetection
    const [labelResp] = await visionClient.labelDetection(imageUrl);
    const [textResp]  = await visionClient.textDetection(imageUrl);

    const labels = (labelResp.labelAnnotations || []).map((label: { description?: string | null }) =>
      (label.description || '').toLowerCase(),
    );
    const ocrText = (textResp.textAnnotations && textResp.textAnnotations[0])
      ? (textResp.textAnnotations[0].description || '').toLowerCase()
      : '';

    const combined = `${labels.join(' ')} ${ocrText} ${descripcion}`.toLowerCase();

    // Mapa inicial de palabras clave -> calorías (extender según necesidades)
    const estimaciones: Record<string, number> = {
      'hamburguesa': 650, 'hamburger': 650, 'pizza': 800, 'ensalada': 200,
      'salad': 200, 'arroz': 350, 'rice': 350, 'pollo': 280, 'chicken': 280,
      'papas': 160, 'fries': 350, 'patatas': 160, 'arepa': 230, 'empanada': 320,
      'jugo': 120, 'gaseosa': 150, 'soda': 150, 'pan': 250, 'fruta': 80,
    };

    let found: number | null = null;
    for (const [key, val] of Object.entries(estimaciones)) {
      if (combined.includes(key)) { found = val; break; }
    }

    if (found !== null) {
      return {
        calorias_estimadas: found,
        fuente_estimacion: 'ia_vision',
        confianza_pct: 60,
        mensaje: 'Estimación basada en etiquetas OCR y descripción. Verifica antes de confirmar.',
      };
    }

    return {
      calorias_estimadas: null,
      fuente_estimacion: 'pendiente',
      confianza_pct: null,
      mensaje: 'No se encontró una estimación fiable desde la imagen.',
    };

  } catch (err: any) {
    return {
      calorias_estimadas: null,
      fuente_estimacion: 'pendiente',
      confianza_pct: null,
      mensaje: `Error al procesar la imagen: ${String(err.message || err)}`,
    };
  }
};

/**
 * Estima calorías desde texto (descripción del alimento).
 * Útil si no hay imagen pero sí hay descripción detallada.
 */
export const estimateFromDescription = async (
  descripcion: string,
): Promise<CalorieEstimationResult> => {

  // Mapa básico de estimaciones por palabras clave (sin IA)
  // En producción esto se reemplaza por llamada a API
  const estimaciones: Record<string, number> = {
    'hamburguesa':  650,
    'pizza':        800,
    'ensalada':     200,
    'arroz':        350,
    'pollo':        280,
    'papa':         160,
    'arepa':        230,
    'empanada':     320,
    'jugo':         120,
    'gaseosa':      150,
    'agua':         0,
    'café':         10,
    'fruta':        80,
    'pan':          250,
  };

  const descripcionLower = descripcion.toLowerCase();
  let caloriasEncontradas: number | null = null;

  for (const [keyword, calorias] of Object.entries(estimaciones)) {
    if (descripcionLower.includes(keyword)) {
      caloriasEncontradas = calorias;
      break;
    }
  }

  if (caloriasEncontradas !== null) {
    return {
      calorias_estimadas:  caloriasEncontradas,
      fuente_estimacion:   'ia_vision',
      confianza_pct:       40, // baja confianza — solo por palabras clave
      mensaje: `Estimación basada en la descripción. Ajusta si es necesario antes de confirmar.`,
    };
  }

  return {
    calorias_estimadas:  null,
    fuente_estimacion:   'pendiente',
    confianza_pct:       null,
    mensaje: 'No se pudo estimar automáticamente. Ingresa las calorías manualmente.',
  };
};