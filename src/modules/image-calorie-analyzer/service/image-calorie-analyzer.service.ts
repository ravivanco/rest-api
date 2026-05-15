import { visionClient } from '@config/vision';
import {
  estimateFromDescription,
  estimateFromImage,
} from '@infrastructure/calorie-estimator';
import { AnalyzeImageDto, ImageCaloriesResult } from '../dto/analyze-image.dto';

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
