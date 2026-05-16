import {
  estimateFromDescription,
  estimateFromImage,
} from '@infrastructure/calorie-estimator';
import {
  AnalyzeImageDto,
  ImageCaloriesResult,
} from '../dto/analyze-image.dto';

const TAG = '[image-calorie-analyzer]';
const log = {
  info:  (...args: unknown[]) => console.log(`ℹ️  ${TAG}`, ...args),
  warn:  (...args: unknown[]) => console.warn(`⚠️  ${TAG}`, ...args),
  error: (...args: unknown[]) => console.error(`❌ ${TAG}`, ...args),
};

export const imageCalorieAnalyzerService = {

  async analyze(data: AnalyzeImageDto): Promise<ImageCaloriesResult> {
    const descripcion = data.descripcion_alimento?.trim() || '';

    log.info('Inicio analyze()', {
      tiene_base64: Boolean(data.imagen_base64),
      tiene_url: Boolean(data.imagen_url),
      descripcion_len: descripcion.length,
    });

    // Determinar la fuente de imagen
    const imageSource = data.imagen_base64
      ? { base64: data.imagen_base64 }
      : { url: data.imagen_url! };

    log.info('Fuente de imagen resuelta', {
      tipo: data.imagen_base64 ? 'base64' : 'url',
    });

    // ── Pipeline principal: Vision + Gemini ────────────────────────────────
    let resultado: ImageCaloriesResult;

    try {
      resultado = await estimateFromImage(imageSource, descripcion);
      log.info('Resultado principal recibido', {
        calorias_estimadas: resultado.calorias_estimadas,
        confianza_pct: resultado.confianza_pct,
        fuente_estimacion: resultado.fuente_estimacion,
        etiquetas_detectadas: resultado.etiquetas_detectadas?.length || 0,
        alimentos_detectados: resultado.alimentos_detectados?.length || 0,
      });
    } catch (err) {
      const error = err as Error;
      log.error('Fallo estimateFromImage()', error.message);
      log.error(error.stack || 'sin stack');
      throw err;
    }

    // ── Fallback: si Gemini no pudo estimar y hay descripción, usar heurística
    if (!resultado.calorias_estimadas && descripcion) {
      log.warn('Sin estimación principal, usando fallback por descripción');
      const fallback = await estimateFromDescription(descripcion);
      resultado = {
        ...fallback,
        // Preservar los datos de Vision aunque haya fallback
        etiquetas_detectadas: resultado.etiquetas_detectadas,
        texto_detectado:      resultado.texto_detectado,
      };
    }

    // ── Mapear al DTO de resultado ─────────────────────────────────────────
    return {
      calorias_estimadas:   resultado.calorias_estimadas,
      porcion_estimada_g:   resultado.porcion_estimada_g ?? null,
      confianza_pct:        resultado.confianza_pct,
      fuente_estimacion:    resultado.fuente_estimacion,
      etiquetas_detectadas: resultado.etiquetas_detectadas || [],
      texto_detectado:      resultado.texto_detectado || null,
      alimentos_detectados: resultado.alimentos_detectados || [],
      macros: {
        proteinas_g:     resultado.macros?.proteinas_g     ?? null,
        carbohidratos_g: resultado.macros?.carbohidratos_g ?? null,
        grasas_g:        resultado.macros?.grasas_g        ?? null,
      },
      mensaje: resultado.mensaje,
    };
  },

};