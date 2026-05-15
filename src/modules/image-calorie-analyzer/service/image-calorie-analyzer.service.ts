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

    const imageSource = data.imagen_base64
      ? { base64: data.imagen_base64 }
      : { url: data.imagen_url };

    let resultado = await estimateFromImage(imageSource, descripcion);

    if (!resultado.calorias_estimadas && descripcion) {
      const fallback = await estimateFromDescription(descripcion);
      resultado = {
        ...fallback,
        etiquetas_detectadas: resultado.etiquetas_detectadas,
        texto_detectado: resultado.texto_detectado,
      };
    }

    return {
      calorias_estimadas:   resultado.calorias_estimadas,
      confianza_pct:        resultado.confianza_pct,
      porcion_estimada_g:   null,
      fuente_estimacion:    resultado.fuente_estimacion,
      etiquetas_detectadas: resultado.etiquetas_detectadas || [],
      texto_detectado:      resultado.texto_detectado || null,
      mensaje:              resultado.mensaje,
    };
  },

};