import { visionClient }       from '@config/vision';
import {
  estimateFromDescription,
  estimateFromImage,
}                             from '@infrastructure/calorie-estimator';
import {
  AnalyzeImageDto,
  ImageCaloriesResult,
}                             from '../dto/analyze-image.dto';

export const imageCalorieAnalyzerService = {

  async analyze(data: AnalyzeImageDto): Promise<ImageCaloriesResult> {
    const descripcion = data.descripcion_alimento?.trim() || '';

    let labels:  string[] = [];
    let ocrText: string   = '';

    // ── Llamar a Google Vision ────────────────────────────────────
    try {
      let visionInput: string | { content: string };

      if (data.imagen_base64) {
        // Extraer solo la parte base64 sin el prefijo "data:image/jpeg;base64,"
        const base64Data = data.imagen_base64.includes(',')
          ? data.imagen_base64.split(',')[1]
          : data.imagen_base64;

        // Google Vision acepta base64 directamente con el campo "content"
        visionInput = { content: base64Data };
      } else if (data.imagen_url) {
        visionInput = data.imagen_url;
      } else {
        throw new Error('No se proporcionó imagen');
      }

      const [labelResp] = await visionClient.labelDetection(visionInput as string);
      const [textResp]  = await visionClient.textDetection(visionInput as string);

      labels = (labelResp.labelAnnotations || [])
        .map((l: { description?: string | null }) =>
          (l.description || '').trim().toLowerCase()
        )
        .filter(Boolean);

      ocrText = (textResp.textAnnotations?.[0]?.description || '').trim();

      console.log('[vision] Labels:', labels.join(', '));

    } catch (visionError: unknown) {
      const msg = visionError instanceof Error
        ? visionError.message
        : String(visionError);
      console.error('[vision] Error Google Vision:', msg);
    }

    // ── Estimar calorías ──────────────────────────────────────────
    let resultado = null;

    // Combinar labels + OCR + descripción para la estimación
    const contexto = [labels.join(' '), ocrText, descripcion]
      .filter(Boolean)
      .join(' ');

    if (contexto.trim()) {
      resultado = await estimateFromImage(
        data.imagen_url || '',
        contexto,
      );
    }

    if (!resultado?.calorias_estimadas && descripcion) {
      resultado = await estimateFromDescription(descripcion);
    }

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