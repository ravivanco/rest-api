import { visionClient } from '@config/vision';
import { geminiClient } from '@config/gemini';
import { env }          from '@config/env';

// ─── Log de arranque: verifica variables críticas ─────────────────────────────
console.log('🔧 [calorie-estimator] Verificando configuración al cargar el módulo...');
console.log(`   GEMINI_API_KEY  : ${env.GEMINI_API_KEY  ? '✅ configurada (' + env.GEMINI_API_KEY.substring(0, 8) + '...)' : '❌ NO CONFIGURADA'}`);
console.log(`   GEMINI_MODEL    : ${env.GEMINI_MODEL}`);
console.log(`   geminiClient    : ${geminiClient ? '✅ inicializado' : '❌ NULL (no se puede analizar con IA)'}`);
console.log(`   GOOGLE_CREDS    : ${process.env.GOOGLE_CREDENTIALS_JSON ? '✅ presente' : '⚠️  NO configurada (Vision usará ADC)'}`);

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

// ─── Logger interno ───────────────────────────────────────────────────────────

const TAG = '[calorie-estimator]';
const log = {
  info:  (...a: unknown[]) => console.log(`ℹ️  ${TAG}`, ...a),
  ok:    (...a: unknown[]) => console.log(`✅ ${TAG}`, ...a),
  warn:  (...a: unknown[]) => console.warn(`⚠️  ${TAG}`, ...a),
  error: (...a: unknown[]) => console.error(`❌ ${TAG}`, ...a),
  step:  (n: number, msg: string) => console.log(`\n🔷 ${TAG} PASO ${n}: ${msg}`),
};

// ─── Helper: descarga imagen con fetch nativo (Node 18+) ─────────────────────

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  log.info('Descargando imagen con fetch...', url);

  const controller = new AbortController();
  // Timeout de 15 segundos — suficiente para Cloudinary
  const timeout = setTimeout(() => {
    controller.abort();
    log.error('Timeout al descargar la imagen (15s superados):', url);
  }, 15_000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} al descargar imagen`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Normalizar el mimeType (quitar parámetros como "; charset=...")
    const mimeType = contentType.split(';')[0].trim();
    log.info('Content-Type de la imagen:', mimeType);

    const buffer     = await response.arrayBuffer();
    const base64     = Buffer.from(buffer).toString('base64');
    log.ok(`Imagen descargada: ${Math.round(base64.length / 1024)} KB en base64, mimeType: ${mimeType}`);

    return { base64, mimeType };

  } catch (err) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw new Error('Timeout al descargar la imagen. Verifica que la URL sea accesible.');
    }
    log.error('Error descargando imagen:', error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Helper: extraer base64 e info de una fuente ─────────────────────────────

async function resolveImageBase64(
  imageSource: ImageSource,
): Promise<{ base64: string; mimeType: string }> {

  if (typeof imageSource === 'object' && imageSource.base64) {
    log.info('Fuente: base64 directo (app móvil)');
    const raw = imageSource.base64;
    let base64   = raw;
    let mimeType = 'image/jpeg';

    if (raw.includes(',')) {
      const match = raw.match(/^data:([^;]+);base64,/);
      if (match) mimeType = match[1];
      base64 = raw.split(',')[1];
    }
    log.info(`Base64 listo: ~${Math.round(base64.length / 1024)} KB, mimeType: ${mimeType}`);
    return { base64, mimeType };
  }

  const url = typeof imageSource === 'string' ? imageSource : imageSource.url!;
  log.info('Fuente: URL pública →', url);

  // Detectar mimeType por extensión antes de descargar
  let mimeTypeHint = 'image/jpeg';
  if (url.includes('.png'))  mimeTypeHint = 'image/png';
  else if (url.includes('.webp')) mimeTypeHint = 'image/webp';
  else if (url.includes('.gif'))  mimeTypeHint = 'image/gif';

  const result = await fetchImageAsBase64(url);
  // Preferir mimeType del Content-Type header, pero usar hint si es genérico
  const finalMime = result.mimeType === 'application/octet-stream' ? mimeTypeHint : result.mimeType;
  return { base64: result.base64, mimeType: finalMime };
}

// ─── Google Vision ────────────────────────────────────────────────────────────

async function extractVisionContext(
  imageSource: ImageSource,
): Promise<{ labels: string[]; ocrText: string }> {
  log.step(1, 'Google Vision — detectando etiquetas y texto OCR');

  // Vision puede recibir Buffer o URL como string
  let visionInput: string | Buffer;

  if (typeof imageSource === 'object' && imageSource.base64) {
    const raw = imageSource.base64.includes(',')
      ? imageSource.base64.split(',')[1]
      : imageSource.base64;
    visionInput = Buffer.from(raw, 'base64');
    log.info('Vision input: Buffer desde base64');
  } else {
    visionInput = typeof imageSource === 'string' ? imageSource : imageSource.url!;
    log.info('Vision input: URL →', visionInput);
  }

  log.info('Llamando labelDetection...');
  const [labelResp] = await visionClient.labelDetection(visionInput as never);

  log.info('Llamando textDetection...');
  const [textResp]  = await visionClient.textDetection(visionInput as never);

  const labels = (labelResp.labelAnnotations || [])
    .map((l: { description?: string | null }) => (l.description || '').toLowerCase())
    .filter(Boolean);

  const ocrText = textResp.textAnnotations?.[0]?.description?.toLowerCase() || '';

  log.ok(`Vision OK — ${labels.length} etiquetas: [${labels.slice(0, 5).join(', ')}${labels.length > 5 ? '...' : ''}]`);
  if (ocrText) log.info('OCR:', ocrText.substring(0, 150));
  else         log.info('OCR: sin texto detectado');

  return { labels, ocrText };
}

// ─── Prompt para Gemini ───────────────────────────────────────────────────────

function buildCaloriePrompt(labels: string[], ocrText: string, descripcion: string): string {
  return `Eres un nutricionista clínico experto en análisis visual de alimentos y composición nutricional. Tu trabajo es analizar imágenes de comidas y estimar su contenido calórico con la mayor precisión posible.

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

1. IMAGEN DEL ALIMENTO → La analizarás directamente (es el input principal)
2. ETIQUETAS DETECTADAS POR GOOGLE VISION → ${labels.join(', ') || 'ninguna detectada'}
3. TEXTO OCR DETECTADO → ${ocrText || 'ninguno detectado'}
4. DESCRIPCIÓN DEL PACIENTE → "${descripcion || 'el paciente no proporcionó descripción'}"

════════════════════════════════════════════════════════
 INSTRUCCIONES
════════════════════════════════════════════════════════

PASO 1 — Identifica todos los alimentos visibles
PASO 2 — Estima porciones (un almuerzo colombiano típico: 300–450g)
PASO 3 — Calcula calorías por componente (usa tablas USDA o colombianas)
PASO 4 — Determina confianza: Alta(75-95%), Media(45-74%), Baja(10-44%), Sin comida(0%)
PASO 5 — Si hay etiqueta nutricional legible → úsala como fuente primaria

════════════════════════════════════════════════════════
 REGLAS CRÍTICAS
════════════════════════════════════════════════════════
✅ Responde ÚNICAMENTE con el JSON abajo, sin markdown, sin texto extra
✅ Si no hay comida → calorias_estimadas: null, confianza_pct: 0
✅ Usa porciones realistas
❌ No inventes alimentos
❌ No pongas calorias_estimadas: 0 si hay comida (usa null)

════════════════════════════════════════════════════════
 FORMATO DE RESPUESTA — JSON EXACTO
════════════════════════════════════════════════════════
{
  "calorias_estimadas": 450,
  "porcion_estimada_g": 320,
  "confianza_pct": 78,
  "alimentos_detectados": [
    { "nombre": "arroz blanco cocido", "cantidad_g": 180, "calorias": 234 },
    { "nombre": "pechuga de pollo", "cantidad_g": 120, "calorias": 186 }
  ],
  "macros": { "proteinas_g": 38, "carbohidratos_g": 45, "grasas_g": 6 },
  "mensaje": "Almuerzo balanceado colombiano. Estimación basada en porción estándar.",
  "fuente": "ia_vision"
}`;
}

// ─── Interfaz cruda de Gemini ─────────────────────────────────────────────────

interface GeminiCalorieResponse {
  calorias_estimadas:   number | null;
  porcion_estimada_g:   number | null;
  confianza_pct:        number;
  alimentos_detectados: Array<{ nombre: string; cantidad_g: number | null; calorias: number }>;
  macros: { proteinas_g: number | null; carbohidratos_g: number | null; grasas_g: number | null };
  mensaje: string;
  fuente:  string;
}

// ─── Llamada a Gemini ─────────────────────────────────────────────────────────

async function callGemini(
  imageSource: ImageSource,
  labels:      string[],
  ocrText:     string,
  descripcion: string,
): Promise<GeminiCalorieResponse | null> {
  log.step(2, 'Gemini 1.5 Flash — análisis visual de la imagen');

  // ── Verificar cliente ────────────────────────────────────────────────────
  if (!geminiClient) {
    log.error('geminiClient es NULL');
    log.error('→ GEMINI_API_KEY no está configurada en las variables de entorno de Render.');
    log.error('→ Ve a Render → tu servicio → Environment → Add environment variable → GEMINI_API_KEY=AIza...');
    return null;
  }
  log.ok(`geminiClient listo. Modelo: ${env.GEMINI_MODEL}`);

  // ── Preparar imagen en base64 ────────────────────────────────────────────
  let imageBase64: string;
  let mimeType: string;

  try {
    const resolved = await resolveImageBase64(imageSource);
    imageBase64    = resolved.base64;
    mimeType       = resolved.mimeType;
  } catch (downloadErr) {
    const err = downloadErr as Error;
    log.error('No se pudo obtener base64 de la imagen:', err.message);
    log.error('→ Verifica que la URL de Cloudinary sea pública (no privada/signed)');
    return null;
  }

  // ── Llamar a Gemini ──────────────────────────────────────────────────────
  try {
    const model  = geminiClient.getGenerativeModel({ model: env.GEMINI_MODEL });
    const prompt = buildCaloriePrompt(labels, ocrText, descripcion);

    log.info(`Enviando a Gemini: imagen ${Math.round(imageBase64.length / 1024)} KB, mimeType: ${mimeType}`);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data:     imageBase64,
        },
      },
      { text: prompt },
    ]);

    const rawText = result.response.text();
    log.info('Respuesta raw de Gemini →', rawText);

    // Limpiar posibles bloques ```json ... ```
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    log.info('JSON limpio →', cleaned);

    const parsed = JSON.parse(cleaned) as GeminiCalorieResponse;
    log.ok(`Gemini OK → ${parsed.calorias_estimadas} kcal, confianza ${parsed.confianza_pct}%, ${parsed.alimentos_detectados?.length ?? 0} alimentos`);
    return parsed;

  } catch (geminiErr) {
    const err = geminiErr as Error;
    log.error('Error en llamada a Gemini:');
    log.error('  Nombre :', err.name);
    log.error('  Mensaje:', err.message);

    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not valid')) {
      log.error('  → CAUSA: GEMINI_API_KEY inválida. Verifica en https://aistudio.google.com/app/apikey');
    } else if (err.message?.includes('PERMISSION_DENIED')) {
      log.error('  → CAUSA: Permiso denegado. Habilita "Generative Language API" en Google Cloud Console.');
    } else if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('quota')) {
      log.error('  → CAUSA: Cuota de Gemini agotada. Espera o activa facturación.');
    } else if (err.message?.includes('JSON') || err.message?.includes('parse')) {
      log.error('  → CAUSA: Gemini no devolvió JSON válido. Ver respuesta raw arriba.');
    } else if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('ECONNRESET')) {
      log.error('  → CAUSA: Error de red al conectar con Gemini API.');
    } else if (err.message?.includes('Candidate was blocked')) {
      log.error('  → CAUSA: Gemini bloqueó el contenido por políticas de seguridad. Intenta con otra imagen.');
    }

    return null;
  }
}

// ─── Función principal exportada ──────────────────────────────────────────────

export const estimateFromImage = async (
  imageSource: ImageSource,
  descripcion: string,
): Promise<CalorieEstimationResult> => {

  log.info('═══════════════════════════════════════════════════════════');
  log.info('INICIO ANÁLISIS CALÓRICO');
  log.info('  Descripción:', descripcion || '(sin descripción)');
  log.info('  Tipo fuente:', typeof imageSource === 'object' && (imageSource as { base64?: string }).base64 ? 'base64' : 'url');
  if (typeof imageSource === 'object' && (imageSource as { url?: string }).url) {
    log.info('  URL:', (imageSource as { url: string }).url);
  }
  log.info('═══════════════════════════════════════════════════════════');

  // ── Paso 1: Google Vision ──────────────────────────────────────────────────
  let labels:  string[] = [];
  let ocrText: string   = '';

  try {
    const ctx = await extractVisionContext(imageSource);
    labels    = ctx.labels;
    ocrText   = ctx.ocrText;
  } catch (visionErr) {
    const err = visionErr as Error;
    log.warn('Google Vision falló — continuando sin contexto de etiquetas');
    log.warn('  Error Vision:', err.message);
    if (err.message?.includes('credentials') || err.message?.includes('CREDENTIALS')) {
      log.warn('  → CAUSA: GOOGLE_CREDENTIALS_JSON mal configurada en Render.');
    } else if (err.message?.includes('PERMISSION_DENIED')) {
      log.warn('  → CAUSA: El service account no tiene acceso a Cloud Vision API.');
    }
    // Vision falla → Gemini igual puede analizar solo con la imagen
  }

  // ── Paso 2: Gemini 1.5 Flash ───────────────────────────────────────────────
  const geminiResult = await callGemini(imageSource, labels, ocrText, descripcion);

  if (geminiResult) {
    log.ok('Pipeline completo con IA (ia_vision)');
    log.info('═══════════════════════════════════════════════════════════\n');
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

  // ── Paso 3: Fallback heurístico ────────────────────────────────────────────
  log.step(3, 'Fallback heurístico (Gemini no disponible)');
  const combined = `${labels.join(' ')} ${ocrText} ${descripcion}`.toLowerCase();
  log.info('Texto combinado heurística:', combined.substring(0, 200));

  const estimaciones: Record<string, number> = {
    'hamburguesa': 650, 'hamburger': 650, 'pizza': 800,
    'ensalada': 200,   'salad': 200,      'arroz': 350,
    'rice': 350,       'pollo': 280,      'chicken': 280,
    'papas': 160,      'fries': 350,      'arepa': 230,
    'empanada': 320,   'jugo': 120,       'gaseosa': 150,
    'soda': 150,       'pan': 250,        'fruta': 80,
    'bandeja': 900,    'sancocho': 450,   'ajiaco': 480,
    'soup': 350,       'salchipapa': 600, 'perro': 420,
  };

  let found: number | null = null;
  for (const [key, val] of Object.entries(estimaciones)) {
    if (combined.includes(key)) {
      log.info(`Match heurístico: "${key}" → ${val} kcal`);
      found = val;
      break;
    }
  }

  log.info('═══════════════════════════════════════════════════════════\n');

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
      mensaje:              'Estimación aproximada. Para mayor precisión, la IA necesita estar correctamente configurada.',
    };
  }

  log.warn('Sin resultados en ningún pipeline. Devolviendo "pendiente".');
  return {
    calorias_estimadas:   null,
    porcion_estimada_g:   null,
    confianza_pct:        null,
    fuente_estimacion:    'pendiente',
    etiquetas_detectadas: labels,
    texto_detectado:      ocrText || null,
    alimentos_detectados: [],
    macros:               { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
    mensaje:              'No se pudo estimar automáticamente. Ingresa las calorías manualmente.',
  };
};

export const estimateFromDescription = async (
  descripcion: string,
): Promise<CalorieEstimationResult> => {
  log.info('estimateFromDescription fallback:', descripcion);

  const estimaciones: Record<string, number> = {
    'hamburguesa': 650, 'pizza': 800,    'ensalada': 200,
    'arroz': 350,       'pollo': 280,    'papa': 160,
    'arepa': 230,       'empanada': 320, 'jugo': 120,
    'gaseosa': 150,     'agua': 0,       'café': 10,
    'fruta': 80,        'pan': 250,      'bandeja': 900,
  };

  const lower = descripcion.toLowerCase();
  for (const [k, v] of Object.entries(estimaciones)) {
    if (lower.includes(k)) {
      return {
        calorias_estimadas:   v,
        porcion_estimada_g:   null,
        confianza_pct:        40,
        fuente_estimacion:    'heuristica',
        etiquetas_detectadas: [lower],
        texto_detectado:      lower,
        alimentos_detectados: [],
        macros:               { proteinas_g: null, carbohidratos_g: null, grasas_g: null },
        mensaje:              'Estimación basada en la descripción. Ajusta si es necesario.',
      };
    }
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
    mensaje:              'No se pudo estimar automáticamente. Ingresa las calorías manualmente.',
  };
};