/**
 * Servicio de estimación calórica desacoplado.
 *
 * ESTADO ACTUAL: Implementación base que retorna null.
 * El paciente ingresa las calorías manualmente.
 *
 * INTEGRACIÓN FUTURA:
 * Para conectar a una API de visión artificial (ej: OpenAI Vision, Google Vision AI):
 * 1. Reemplaza el cuerpo de estimateFromImage()
 * 2. Agrega las credenciales en .env
 * 3. El resto del sistema no necesita cambios
 *
 * Ejemplo de integración futura:
 *   const response = await openai.chat.completions.create({
 *     model: "gpt-4-vision-preview",
 *     messages: [{ role: "user", content: [
 *       { type: "image_url", image_url: { url: imageUrl } },
 *       { type: "text", text: "Estima las calorías de este alimento en kcal. Solo el número." }
 *     ]}]
 *   });
 *   return parseInt(response.choices[0].message.content ?? '0');
 */

export interface CalorieEstimationResult {
  calorias_estimadas:     number | null;
  fuente_estimacion:      'manual' | 'ia_vision' | 'pendiente';
  confianza_pct:          number | null;  // 0-100, null si no hay IA
  mensaje:                string;
}

/**
 * Estima las calorías a partir de una URL de imagen.
 * Actualmente retorna null — el paciente las ingresa manualmente.
 */
export const estimateFromImage = async (
  _imageUrl: string,
  _descripcion: string,
): Promise<CalorieEstimationResult> => {

  // Implementación futura de IA va aquí
  // Por ahora retorna estado 'pendiente' para que el usuario las ingrese
  return {
    calorias_estimadas:  null,
    fuente_estimacion:   'pendiente',
    confianza_pct:       null,
    mensaje: 'Ingresa las calorías estimadas manualmente para confirmar el consumo.',
  };
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