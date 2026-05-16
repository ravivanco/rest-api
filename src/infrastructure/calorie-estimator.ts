import { visionClient } from '@config/vision';
import { geminiClient } from '@config/gemini';
import { env }          from '@config/env';
import https            from 'https';
import http             from 'http';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AlimentoDetectado {
  nombre:     string;
  cantidad_g: number | null;
  calorias:   number;
}

export interface MacrosResult {
  proteinas_g:      number | null;
  carbohidratos_g:  number | null;
  grasas_g:         number | null;
}

export interface CalorieEstimationResult {
  calorias_estimadas:   number | null;
  porcion_estimada_g:   number | null;
  confianza_pct:        number | null;
  fuente_estimacion:    'manual' | 'ia_vision' | 'heuristica' | 'pendiente';
  etiquetas_detectadas: string[];
  texto_detectado:      string | null;
  alimentos_detectados: AlimentoDetectado[];
  macros:               MacrosResult;
  mensaje:              string;
}

export type ImageSource = string | { url?: string; base64?: string };

// ─── Helpers internos ─────────────────────────────────────────────────────────

type VisionInput = string | Buffer;

function buildVisionInput(imageSource: ImageSource): VisionInput {
  if (typeof imageSource === 'string') return imageSource;

  if (imageSource.base64) {
    const base64Data = imageSource.base64.includes(',')
      ? imageSource.base64.split(',')[1]
      : imageSource.base64;
    return Buffer.from(base64Data, 'base64');
  }

  if (imageSource.url) return imageSource.url;

  throw new Error('Debes enviar una URL o un base64 válido');
}

/**
 * Descarga una imagen desde una URL y la devuelve como string base64.
 * Soporta http y https.
 */
function fetchImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Llama a Google Vision para obtener etiquetas de objetos y texto OCR.
 */
async function extractVisionContext(imageSource: ImageSource): Promise<{
  labels:   string[];
  ocrText:  string;
}> {
  const visionInput = buildVisionInput(imageSource);

  const [labelResp] = await visionClient.labelDetection(visionInput as never);
  const [textResp]  = await visionClient.textDetection(visionInput as never);

  const labels = (labelResp.labelAnnotations || [])
    .map((label: { description?: string | null }) => (label.description || '').toLowerCase())
    .filter(Boolean);

  const ocrText = (textResp.textAnnotations && textResp.textAnnotations[0])
    ? (textResp.textAnnotations[0].description || '').toLowerCase()
    : '';

  return { labels, ocrText };
}

/**
 * Construye el prompt detallado para Gemini con las variables de contexto.
 * Basado en el prompt de src/PROMPT_GEMINI_CALORIE_ANALYZER.md
 */
function buildCaloriePrompt(
  labels:      string[],
  ocrText:     string,
  descripcion: string,
): string {
  return `Eres un nutricionista clínico experto en análisis visual de alimentos
y composición nutricional. Tu trabajo es analizar imágenes de comidas
y estimar su contenido calórico con la mayor precisión posible.

════════════════════════════════════════════════════════
 ROL
════════════════════════════════════════════════════════

Actúa como un nutricionista con experiencia en:
- Estimación de porciones por tamaño visual
- Gastronomía colombiana y latinoamericana
- Lectura de etiquetas nutricionales
- Análisis de alimentos procesados y naturales

════════════════════════════════════════════════════════
 INFORMACIÓN DISPONIBLE PARA ESTE ANÁLISIS
════════════════════════════════════════════════════════

Tienes acceso a los siguientes datos para complementar lo que ves:

1. IMAGEN DEL ALIMENTO
   → La analizarás directamente (es el input principal)

2. ETIQUETAS DETECTADAS POR GOOGLE VISION
   → ${labels.join(', ') || 'ninguna detectada'}
   → Úsalas para confirmar o descartar lo que ves

3. TEXTO OCR DETECTADO EN LA IMAGEN
   → ${ocrText || 'ninguno detectado'}
   → Si hay información nutricional en texto, es tu referencia más confiable

4. DESCRIPCIÓN DEL PACIENTE
   → "${descripcion || 'el paciente no proporcionó descripción'}"
   → Puede darte contexto que la imagen no muestra (ej: "con aceite", "sin sal")

════════════════════════════════════════════════════════
 INSTRUCCIONES DE ANÁLISIS (sigue este orden)
════════════════════════════════════════════════════════

PASO 1 — Identifica todos los alimentos visibles
  - Lista cada alimento o ingrediente que puedas ver en la imagen
  - Si hay varios componentes en el plato, identifica cada uno

PASO 2 — Estima las porciones
  - Usa referencias visuales estándar (tamaño de puño, plato, vaso)
  - Un plato colombiano típico de almuerzo: 300–450g total
  - Estima gramos de cada componente por separado

PASO 3 — Calcula las calorías
  - Usa tablas nutricionales estándar (USDA o equivalentes colombianos)
  - Calcula por cada componente identificado
  - Suma el total del plato completo

PASO 4 — Determina tu nivel de confianza
  - Alta confianza (75–95%): imagen clara, alimentos identificables, porciones visibles
  - Confianza media (45–74%): imagen algo ambigua o porciones difíciles de estimar
  - Baja confianza (10–44%): imagen borrosa, alimentos muy mezclados, no reconocibles
  - Sin confianza (0%): la imagen no contiene comida

PASO 5 — Considera el contexto
  - Si el OCR tiene información nutricional en una etiqueta → úsala como fuente primaria
  - Si la descripción del paciente contradice lo que ves → menciona la discrepancia en el mensaje
  - Si la imagen muestra comida colombiana típica → aplica porciones colombianas estándar

════════════════════════════════════════════════════════
 REGLAS CRÍTICAS (no negociables)
════════════════════════════════════════════════════════

✅ Responde ÚNICAMENTE con el JSON especificado abajo
✅ El JSON debe ser válido — sin texto antes ni después
✅ Sin bloques markdown, sin comillas extra, sin explicaciones
✅ El campo "mensaje" siempre en español, máximo 2 oraciones
✅ Si no hay comida en la imagen → calorias_estimadas: null, confianza_pct: 0
✅ Usa porciones realistas (no asumas un kilo de comida por defecto)
✅ Si hay etiqueta nutricional legible → usa esos datos exactos
❌ No inventes alimentos que no están en la imagen
❌ No pongas calorias_estimadas: 0 si hay comida (pon null si no puedes estimar)

════════════════════════════════════════════════════════
 FORMATO DE RESPUESTA — JSON EXACTO
════════════════════════════════════════════════════════

{
  "calorias_estimadas": 450,
  "porcion_estimada_g": 320,
  "confianza_pct": 78,
  "alimentos_detectados": [
    {
      "nombre": "arroz blanco cocido",
      "cantidad_g": 180,
      "calorias": 234
    },
    {
      "nombre": "pechuga de pollo a la plancha",
      "cantidad_g": 120,
      "calorias": 186
    }
  ],
  "macros": {
    "proteinas_g": 38,
    "carbohidratos_g": 45,
    "grasas_g": 6
  },
  "mensaje": "Almuerzo balanceado con buena proporción de proteína y carbohidratos. Estimación basada en porción estándar de restaurante colombiano.",
  "fuente": "ia_vision"
}`;
}

// ─── Interfaz de la respuesta cruda de Gemini ─────────────────────────────────

interface GeminiCalorieResponse {
  calorias_estimadas:   number | null;
  porcion_estimada_g:   number | null;
  confianza_pct:        number;
  alimentos_detectados: Array<{
    nombre:     string;
    cantidad_g: number | null;
    calorias:   number;
  }>;
  macros: {
    proteinas_g:     number | null;
    carbohidratos_g: number | null;
    grasas_g:        number | null;
  };
  mensaje: string;
  fuente:  string;
}

/**
 * Llama a Gemini 1.5 Flash con la imagen y el prompt.
 * Devuelve la respuesta JSON parseada o null si falla.
 */
async function callGemini(
  imageSource: ImageSource,
  labels:      string[],
  ocrText:     string,
  descripcion: string,
): Promise<GeminiCalorieResponse | null> {
  if (!geminiClient) {
    console.warn('[calorie-estimator] geminiClient no disponible (falta GEMINI_API_KEY)');
    return null;
  }

  try {
    const model  = geminiClient.getGenerativeModel({ model: env.GEMINI_MODEL });
    const prompt = buildCaloriePrompt(labels, ocrText, descripcion);

    // Obtener base64 de la imagen
    let imageBase64: string;
    let mimeType = 'image/jpeg';

    if (typeof imageSource === 'object' && imageSource.base64) {
      // Viene directo como base64 desde la app móvil
      const raw = imageSource.base64;
      if (raw.includes(',')) {
        // Extraer mimeType del data URL
        const match = raw.match(/^data:([^;]+);base64,/);
        if (match) mimeType = match[1];
        imageBase64 = raw.split(',')[1];
      } else {
        imageBase64 = raw;
      }
    } else {
      // URL pública (Cloudinary, etc.) — descargar y convertir
      const url = typeof imageSource === 'string' ? imageSource : imageSource.url!;
      // Detectar tipo por extensión
      if (url.includes('.png')) mimeType = 'image/png';
      else if (url.includes('.webp')) mimeType = 'image/webp';
      imageBase64 = await fetchImageAsBase64(url);
    }

    const result = await model.generateContent([
      // 1. Imagen como base64
      {
        inlineData: {
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
          data:     imageBase64,
        },
      },
      // 2. Prompt con todo el contexto
      { text: prompt },
    ]);

    // Parsear la respuesta — Gemini puede envolver en ```json ... ```
    const raw    = result.response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw) as GeminiCalorieResponse;
    return parsed;

  } catch (err) {
    console.error('[calorie-estimator] Error llamando a Gemini:', err);
    return null;
  }
}

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * Pipeline completo: Google Vision → Gemini 1.5 Flash → CalorieEstimationResult
 *
 * Flujo:
 *   1. Google Vision extrae etiquetas y texto OCR de la imagen
 *   2. Se construye el prompt con esos datos + descripción del paciente
 *   3. Gemini analiza la imagen + prompt y devuelve JSON estructurado
 *   4. Si Gemini falla, se intenta heurística básica como fallback
 */
export const estimateFromImage = async (
  imageSource: ImageSource,
  descripcion: string,
): Promise<CalorieEstimationResult> => {
  // ── Paso 1: Google Vision ──────────────────────────────────────────────────
  let labels:  string[] = [];
  let ocrText: string   = '';

  try {
    const ctx = await extractVisionContext(imageSource);
    labels    = ctx.labels;
    ocrText   = ctx.ocrText;
  } catch (visionErr) {
    console.warn('[calorie-estimator] Google Vision falló, continuando sin contexto:', visionErr);
  }

  // ── Paso 2: Gemini 1.5 Flash ───────────────────────────────────────────────
  const geminiResult = await callGemini(imageSource, labels, ocrText, descripcion);

  if (geminiResult) {
    return {
      calorias_estimadas:   geminiResult.calorias_estimadas,
      porcion_estimada_g:   geminiResult.porcion_estimada_g ?? null,
      confianza_pct:        geminiResult.confianza_pct,
      fuente_estimacion:    'ia_vision',
      etiquetas_detectadas: labels,
      texto_detectado:      ocrText || null,
      alimentos_detectados: (geminiResult.alimentos_detectados || []).map(a => ({
        nombre:     a.nombre,
        cantidad_g: a.cantidad_g ?? null,
        calorias:   a.calorias,
      })),
      macros: {
        proteinas_g:     geminiResult.macros?.proteinas_g     ?? null,
        carbohidratos_g: geminiResult.macros?.carbohidratos_g ?? null,
        grasas_g:        geminiResult.macros?.grasas_g        ?? null,
      },
      mensaje: geminiResult.mensaje,
    };
  }

  // ── Paso 3: Fallback heurístico si Gemini no está disponible ───────────────
  console.warn('[calorie-estimator] Usando fallback heurístico (Gemini no disponible)');

  const combined = `${labels.join(' ')} ${ocrText} ${descripcion}`.toLowerCase();
  const estimaciones: Record<string, number> = {
    'hamburguesa': 650, 'hamburger': 650,
    'pizza': 800,
    'ensalada': 200,   'salad': 200,
    'arroz': 350,      'rice': 350,
    'pollo': 280,      'chicken': 280,
    'papas': 160,      'fries': 350,
    'arepa': 230,
    'empanada': 320,
    'jugo': 120,
    'gaseosa': 150,    'soda': 150,
    'pan': 250,
    'fruta': 80,
  };

  let found: number | null = null;
  for (const [key, val] of Object.entries(estimaciones)) {
    if (combined.includes(key)) { found = val; break; }
  }

  if (found !== null) {
    return {
      calorias_estimadas:   found,
      porcion_estimada_g:   null,
      confianza_pct:        40,
      fuente_estimacion:    'heuristica',
      etiquetas_detectadas: labels,
      texto_detectado:      ocrText || null,
      alimentos_detectados: [],
      macros:               { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
      mensaje: 'Estimación aproximada por palabras clave. Para mayor precisión, configura GEMINI_API_KEY.',
    };
  }

  return {
    calorias_estimadas:   null,
    porcion_estimada_g:   null,
    confianza_pct:        null,
    fuente_estimacion:    'pendiente',
    etiquetas_detectadas: labels,
    texto_detectado:      ocrText || null,
    alimentos_detectados: [],
    macros:               { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
    mensaje: 'No se pudo estimar automáticamente. Ingresa las calorías manualmente.',
  };
};

/**
 * Estima calorías desde texto (descripción del alimento) sin imagen.
 * Útil como fallback cuando no hay imagen disponible.
 */
export const estimateFromDescription = async (
  descripcion: string,
): Promise<CalorieEstimationResult> => {
  const estimaciones: Record<string, number> = {
    'hamburguesa': 650, 'pizza': 800,  'ensalada': 200,
    'arroz': 350,       'pollo': 280,  'papa': 160,
    'arepa': 230,       'empanada': 320, 'jugo': 120,
    'gaseosa': 150,     'agua': 0,     'café': 10,
    'fruta': 80,        'pan': 250,
  };

  const lower = descripcion.toLowerCase();
  let found: number | null = null;

  for (const [keyword, calorias] of Object.entries(estimaciones)) {
    if (lower.includes(keyword)) { found = calorias; break; }
  }

  if (found !== null) {
    return {
      calorias_estimadas:   found,
      porcion_estimada_g:   null,
      confianza_pct:        40,
      fuente_estimacion:    'heuristica',
      etiquetas_detectadas: [lower],
      texto_detectado:      lower,
      alimentos_detectados: [],
      macros:               { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
      mensaje: 'Estimación basada en la descripción. Ajusta si es necesario antes de confirmar.',
    };
  }

  return {
    calorias_estimadas:   null,
    porcion_estimada_g:   null,
    confianza_pct:        null,
    fuente_estimacion:    'pendiente',
    etiquetas_detectadas: [],
    texto_detectado:      null,
    alimentos_detectados: [],
    macros:               { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
    mensaje: 'No se pudo estimar automáticamente. Ingresa las calorías manualmente.',
  };
};