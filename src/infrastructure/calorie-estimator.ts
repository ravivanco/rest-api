import { geminiClient } from '@config/gemini';
import { env } from '@config/env';

export interface CalorieEstimationResult {
  calorias_estimadas: number | null;
  fuente_estimacion: 'manual' | 'ia_vision' | 'heuristica' | 'pendiente';
  confianza_pct: number | null;
  porcion_estimada_g: number | null;
  mensaje: string;
  etiquetas_detectadas: string[];
  texto_detectado: string | null;
  alimentos_detectados?: { nombre: string; cantidad_g: number | null; calorias: number }[];
  macros?: {
    proteinas_g: number | null;
    carbohidratos_g: number | null;
    grasas_g: number | null;
  };
}

export type ImageSource = string | { url?: string; base64?: string };

type GeminiResponse = {
  calorias_estimadas?: number | null;
  porcion_estimada_g?: number | null;
  confianza_pct?: number | null;
  alimentos_detectados?: Array<{ nombre: string; cantidad_g: number | null; calorias: number }>;
  macros?: {
    proteinas_g?: number | null;
    carbohidratos_g?: number | null;
    grasas_g?: number | null;
  };
  mensaje?: string;
  fuente?: string;
};

const TAG = '[Gemini]';

function getMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function extractBase64(raw: string): string {
  if (raw.includes(',')) {
    return raw.split(',')[1] || raw;
  }
  return raw;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  console.log(`${TAG} Descargando imagen:`, url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar imagen: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get('content-type')?.split(';')[0].trim() || getMimeType(url);

  console.log(`${TAG} Imagen descargada OK — mimeType: ${mimeType} — bytes: ${buffer.length}`);
  return { data: buffer.toString('base64'), mimeType };
}

function buildCaloriePrompt(descripcion: string): string {
  return `Eres un nutricionista clínico experto en análisis visual de alimentos y composición nutricional.

TAREA:
Analiza la imagen de comida que se te envía y estima su contenido calórico.
${descripcion ? `El paciente describe su comida como: "${descripcion}"` : ''}

INSTRUCCIONES:
- Identifica cada alimento o ingrediente visible en la imagen
- Estima la porción en gramos usando referencias visuales estándar
- Calcula calorías de cada componente por separado
- Considera porciones típicas colombianas/latinoamericanas cuando aplique
- Un plato de almuerzo colombiano típico pesa entre 300–500g
- Si hay texto nutricional visible, úsalo como referencia principal
- Si la imagen es borrosa o ambigua, baja confianza_pct por debajo de 40

RESPONDE ÚNICAMENTE con este JSON válido, sin texto adicional, sin markdown, sin bloques de código:
{
  "calorias_estimadas": 450,
  "porcion_estimada_g": 320,
  "confianza_pct": 78,
  "alimentos_detectados": [
    { "nombre": "arroz blanco cocido", "cantidad_g": 180, "calorias": 234 },
    { "nombre": "pechuga de pollo a la plancha", "cantidad_g": 120, "calorias": 186 }
  ],
  "macros": {
    "proteinas_g": 38,
    "carbohidratos_g": 45,
    "grasas_g": 6
  },
  "mensaje": "Almuerzo balanceado típico colombiano. Estimación basada en porción estándar de restaurante.",
  "fuente": "ia_vision"
}

REGLAS CRÍTICAS:
- NUNCA pongas texto fuera del JSON
- Si no hay comida en la imagen: calorias_estimadas null, confianza_pct 0
- No inventes alimentos que no están en la imagen
- El mensaje debe ser en español, máximo 2 oraciones, útil para el paciente
- La suma de calorias en alimentos_detectados debe ser igual a calorias_estimadas`;
}

function parseGeminiJson(rawText: string): GeminiResponse {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidate = cleaned.startsWith('{') || cleaned.startsWith('[')
    ? cleaned
    : (cleaned.match(/(\{[\s\S]*\})/)?.[1] ?? cleaned);

  return JSON.parse(candidate) as GeminiResponse;
}

async function analyzeWithGemini(imageSource: ImageSource, descripcion: string): Promise<CalorieEstimationResult | null> {
  if (!geminiClient) {
    console.warn(`${TAG} Cliente no inicializado — falta GEMINI_API_KEY en variables de entorno`);
    return null;
  }

  const imageUrl = typeof imageSource === 'string'
    ? imageSource
    : (imageSource.url ?? '');

  const imageBase64 = typeof imageSource === 'object' && imageSource.base64
    ? extractBase64(imageSource.base64)
    : '';

  if (!imageUrl && !imageBase64) {
    return null;
  }

  const modelNames = Array.from(new Set([
    env.GEMINI_MODEL,
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
  ].filter(Boolean)));

  const prompt = buildCaloriePrompt(descripcion);

  for (const modelName of modelNames) {
    try {
      const model = geminiClient.getGenerativeModel({ model: modelName });

      let inlineData: { data: string; mimeType: string };
      if (imageBase64) {
        inlineData = {
          data: imageBase64,
          mimeType: 'image/jpeg',
        };
      } else {
        inlineData = await fetchImageAsBase64(imageUrl);
      }

      console.log(`${TAG} Enviando imagen a Gemini (${modelName})...`);

      const result = await model.generateContent([
        { inlineData },
        { text: prompt },
      ]);

      const raw = result.response.text();
      console.log(`${TAG} Respuesta raw:`, raw.substring(0, 200));

      const parsed = parseGeminiJson(raw);

      console.log(`${TAG} ✅ Análisis exitoso — calorías:`, parsed.calorias_estimadas);

      return {
        calorias_estimadas: parsed.calorias_estimadas ?? null,
        porcion_estimada_g: parsed.porcion_estimada_g ?? null,
        confianza_pct: parsed.confianza_pct ?? null,
        fuente_estimacion: 'ia_vision',
        mensaje: parsed.mensaje ?? 'Análisis completado por IA.',
        etiquetas_detectadas: [],
        texto_detectado: null,
        alimentos_detectados: parsed.alimentos_detectados ?? [],
        macros: parsed.macros ?? {
          proteinas_g: null,
          carbohidratos_g: null,
          grasas_g: null,
        },
      };
    } catch (err) {
      const error = err as Error & { status?: number; errorDetails?: unknown };
      console.error(`${TAG} ❌ Error completo (${modelName}):`, JSON.stringify({
        message: error.message,
        status: error.status,
        details: error.errorDetails,
      }, null, 2));
    }
  }

  return null;
}

export const estimateFromImage = async (
  imageSource: ImageSource,
  descripcion: string,
): Promise<CalorieEstimationResult> => {
  const resultado = await analyzeWithGemini(imageSource, descripcion);

  if (resultado) {
    return resultado;
  }

  return {
    calorias_estimadas: null,
    fuente_estimacion: 'pendiente',
    confianza_pct: null,
    porcion_estimada_g: null,
    mensaje: 'No se pudo analizar la imagen automáticamente. Por favor ingresa las calorías manualmente.',
    etiquetas_detectadas: [],
    texto_detectado: null,
    alimentos_detectados: [],
    macros: { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
  };
};

export const estimateFromDescription = async (
  descripcion: string,
): Promise<CalorieEstimationResult> => {
  if (!geminiClient) {
    return {
      calorias_estimadas: null,
      fuente_estimacion: 'pendiente',
      confianza_pct: null,
      porcion_estimada_g: null,
      mensaje: 'Ingresa las calorías manualmente.',
      etiquetas_detectadas: [],
      texto_detectado: null,
      alimentos_detectados: [],
      macros: { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
    };
  }

  try {
    const model = geminiClient.getGenerativeModel({ model: env.GEMINI_MODEL });
    const prompt = `Eres nutricionista clínico. El paciente describe su comida así: "${descripcion}".
Estima las calorías y devuelve SOLO este JSON válido sin texto adicional:
{
  "calorias_estimadas": 400,
  "porcion_estimada_g": 300,
  "confianza_pct": 50,
  "alimentos_detectados": [{ "nombre": "alimento", "cantidad_g": 150, "calorias": 200 }],
  "macros": { "proteinas_g": 20, "carbohidratos_g": 40, "grasas_g": 10 },
  "mensaje": "Estimación basada en la descripción del paciente. Ajusta si es necesario.",
  "fuente": "heuristica"
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = parseGeminiJson(raw);

    return {
      calorias_estimadas: parsed.calorias_estimadas ?? null,
      porcion_estimada_g: parsed.porcion_estimada_g ?? null,
      confianza_pct: parsed.confianza_pct ?? null,
      fuente_estimacion: 'heuristica',
      mensaje: parsed.mensaje ?? 'Estimación por descripción.',
      etiquetas_detectadas: [descripcion],
      texto_detectado: descripcion,
      alimentos_detectados: parsed.alimentos_detectados ?? [],
      macros: parsed.macros ?? { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
    };
  } catch (err) {
    console.error(`${TAG} Error en estimateFromDescription:`, (err as Error).message);

    const lower = descripcion.toLowerCase();
    const heuristics: Record<string, number> = {
      hamburguesa: 650,
      pizza: 800,
      ensalada: 200,
      arroz: 350,
      pollo: 280,
      papa: 160,
      arepa: 230,
      empanada: 320,
      jugo: 120,
      gaseosa: 150,
      agua: 0,
      café: 10,
      fruta: 80,
      pan: 250,
      bandeja: 900,
      cevichocho: 320,
      'ceviche de chochos': 320,
      chocho: 180,
    };

    for (const [key, calories] of Object.entries(heuristics)) {
      if (lower.includes(key)) {
        return {
          calorias_estimadas: calories,
          fuente_estimacion: 'heuristica',
          confianza_pct: 40,
          porcion_estimada_g: null,
          mensaje: 'Estimación basada en la descripción del paciente. Ajusta si es necesario.',
          etiquetas_detectadas: [descripcion],
          texto_detectado: descripcion,
          alimentos_detectados: [],
          macros: { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
        };
      }
    }

    return {
      calorias_estimadas: null,
      fuente_estimacion: 'pendiente',
      confianza_pct: null,
      porcion_estimada_g: null,
      mensaje: 'No se pudo estimar. Ingresa las calorías manualmente.',
      etiquetas_detectadas: [],
      texto_detectado: null,
      alimentos_detectados: [],
      macros: { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
    };
  }
};