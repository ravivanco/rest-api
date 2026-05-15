import { AppError, ExternalServiceError } from '@errors/AppError';
import { visionClient } from '@config/vision';
import {
  estimateFromDescription,
  estimateFromImage,
} from '@infrastructure/calorie-estimator';
import { AnalyzeImageDto, ImageCaloriesResult } from '../dto/analyze-image.dto';

const OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_TEMPERATURE = 0.2;
const OPENAI_MAX_TOKENS = 400;

interface OpenAICalorieResponse {
  calorias_estimadas: number | null;
  confianza_pct: number | null;
  porcion_estimada_g: number | null;
  mensaje: string;
}

const parseOpenAIResponse = (content: string): OpenAICalorieResponse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ExternalServiceError('OpenAI', 'Respuesta JSON malformada');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ExternalServiceError('OpenAI', 'Respuesta invalida');
  }

  const data = parsed as Partial<OpenAICalorieResponse>;

  return {
    calorias_estimadas:
      typeof data.calorias_estimadas === 'number' ? Math.round(data.calorias_estimadas) : null,
    confianza_pct:
      typeof data.confianza_pct === 'number' ? Math.round(data.confianza_pct) : null,
    porcion_estimada_g:
      typeof data.porcion_estimada_g === 'number' ? Math.round(data.porcion_estimada_g) : null,
    mensaje: typeof data.mensaje === 'string' && data.mensaje.trim().length > 0
      ? data.mensaje.trim()
      : 'Estimacion generada por IA',
  };
};

const buildPrompt = (params: {
  imagenUrl: string;
  descripcion: string;
  labels: string[];
  ocrText: string;
}): { system: string; user: string } => {
  const system =
    'Eres un nutricionista clinico experto en estimacion calorica por imagen. '
    + 'Debes ser conservador con la confianza y devolver SOLO JSON valido.';

  const user = [
    'Analiza el alimento usando contexto de Vision + descripcion del usuario.',
    `imagen_url: ${params.imagenUrl}`,
    `descripcion_usuario: ${params.descripcion || 'sin descripcion'}`,
    `labels_vision: ${params.labels.join(', ') || 'sin labels'}`,
    `texto_ocr: ${params.ocrText || 'sin texto'}`,
    '',
    'Reglas:',
    '- Estima calorias para una porcion individual.',
    '- Si hay poca certeza, devuelve confianza baja.',
    '- Si no puedes inferir con calidad, devuelve calorias_estimadas = null.',
    '- confianza_pct entre 0 y 100.',
    '- porcion_estimada_g entre 30 y 1500 si aplica.',
    '',
    'Responde SOLO con JSON con este schema exacto:',
    '{',
    '  "calorias_estimadas": number | null,',
    '  "confianza_pct": number | null,',
    '  "porcion_estimada_g": number | null,',
    '  "mensaje": "string corto explicando la estimacion"',
    '}',
  ].join('\n');

  return { system, user };
};

const callOpenAI = async (system: string, user: string): Promise<OpenAICalorieResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY no definida', 500, 'INTERNAL_ERROR');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      max_tokens: OPENAI_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ExternalServiceError('OpenAI', `HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new ExternalServiceError('OpenAI', 'Respuesta sin contenido');
  }

  return parseOpenAIResponse(content);
};

export const imageCalorieAnalyzerService = {
  async analyze(data: AnalyzeImageDto): Promise<ImageCaloriesResult> {
    const descripcion = data.descripcion_alimento?.trim() || '';

    const [labelResp] = await visionClient.labelDetection(data.imagen_url);
    const [textResp] = await visionClient.textDetection(data.imagen_url);

    const labels = (labelResp.labelAnnotations || [])
      .map((l: { description?: string | null }) => (l.description || '').trim().toLowerCase())
      .filter(Boolean);

    const ocrText = (textResp.textAnnotations && textResp.textAnnotations[0])
      ? (textResp.textAnnotations[0].description || '').trim()
      : '';

    const fallback = await estimateFromImage(data.imagen_url, descripcion);
    const fallbackWithDescription = (!fallback.calorias_estimadas && descripcion)
      ? await estimateFromDescription(descripcion)
      : fallback;

    if (process.env.OPENAI_API_KEY) {
      const { system, user } = buildPrompt({
        imagenUrl: data.imagen_url,
        descripcion,
        labels,
        ocrText,
      });

      try {
        const ai = await callOpenAI(system, user);

        return {
          calorias_estimadas: ai.calorias_estimadas ?? fallbackWithDescription.calorias_estimadas,
          confianza_pct: ai.confianza_pct ?? fallbackWithDescription.confianza_pct,
          porcion_estimada_g: ai.porcion_estimada_g,
          fuente_estimacion: 'ia_vision_openai',
          etiquetas_detectadas: labels,
          texto_detectado: ocrText || null,
          mensaje: ai.mensaje || fallbackWithDescription.mensaje,
        };
      } catch {
        // Si OpenAI falla, devolvemos estimacion base de Vision para no romper el endpoint.
      }
    }

    return {
      calorias_estimadas: fallbackWithDescription.calorias_estimadas,
      confianza_pct: fallbackWithDescription.confianza_pct,
      porcion_estimada_g: null,
      fuente_estimacion: fallbackWithDescription.fuente_estimacion,
      etiquetas_detectadas: labels,
      texto_detectado: ocrText || null,
      mensaje: fallbackWithDescription.mensaje,
    };
  },
};
