import { visionClient }          from '@config/vision';
import {
  estimateFromDescription,
  estimateFromImage,
}                                from '@infrastructure/calorie-estimator';
import {
  AnalyzeImageDto,
  ImageCaloriesResult,
}                                from '../dto/analyze-image.dto';

export const imageCalorieAnalyzerService = {

  async analyze(data: AnalyzeImageDto): Promise<ImageCaloriesResult> {
    const descripcion = data.descripcion_alimento?.trim() || '';

    let labels:  string[] = [];
    let ocrText: string   = '';

    // ── Llamar a Google Vision con manejo de error ────────────────
    try {
      const [labelResp] = await visionClient.labelDetection(data.imagen_url);
      const [textResp]  = await visionClient.textDetection(data.imagen_url);

      labels = (labelResp.labelAnnotations || [])
        .map((l: { description?: string | null }) =>
          (l.description || '').trim().toLowerCase()
        )
        .filter(Boolean);

      ocrText = (textResp.textAnnotations?.[0]?.description || '').trim();

      console.log('[vision] Labels detectados:', labels.join(', '));
      console.log('[vision] OCR detectado:', ocrText.slice(0, 100));

    } catch (visionError: unknown) {
      // Vision falló — seguimos con la estimación por descripción
      const msg = visionError instanceof Error
        ? visionError.message
        : String(visionError);
      console.error('[vision] Error al llamar Google Vision:', msg);
    }

    // ── Estimar calorías ──────────────────────────────────────────

    // Si Vision detectó etiquetas, intentar estimación por imagen
    let resultado = null;

    if (labels.length > 0 || ocrText) {
      resultado = await estimateFromImage(data.imagen_url, descripcion);
    }

    // Si no hay resultado o Vision falló, usar descripción de texto
    if (!resultado?.calorias_estimadas && descripcion) {
      resultado = await estimateFromDescription(descripcion);
    }

    // Si tampoco hay resultado, retornar pendiente
    if (!resultado) {
      resultado = {
        calorias_estimadas: null,
        fuente_estimacion:  'pendiente' as const,
        confianza_pct:      null,
        mensaje: 'No se pudo estimar. Ingresa las calorías manualmente.',
      };
    }

    return {
      calorias_estimadas:   resultado.calorias_estimadas,
      confianza_pct:        resultado.confianza_pct,
      porcion_estimada_g:   null,
      fuente_estimacion:    resultado.fuente_estimacion,
      etiquetas_detectadas: labels,
      texto_detectado:      ocrText || null,
      mensaje:              resultado.mensaje,
    };
  },

};