import {
  estimateFromDescription,
  estimateFromImage,
} from '@infrastructure/calorie-estimator';
import {
  AnalyzeImageDto,
  ImageCaloriesResult,
} from '../dto/analyze-image.dto';

export const imageCalorieAnalyzerService = {

  async analyze(data: AnalyzeImageDto): Promise<ImageCaloriesResult> {
    const descripcion = data.descripcion_alimento?.trim() || '';

    // Determinar la fuente de imagen
    const imageSource = data.imagen_base64
      ? { base64: data.imagen_base64 }
      : { url: data.imagen_url! };

    // ── Pipeline principal: Vision + Gemini ────────────────────────────────
    let resultado = await estimateFromImage(imageSource, descripcion);

    // ── Fallback: si Gemini no pudo estimar y hay descripción, usar heurística
    if (!resultado.calorias_estimadas && descripcion) {
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