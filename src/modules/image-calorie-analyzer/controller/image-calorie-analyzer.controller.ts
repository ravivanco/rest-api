import { NextFunction, Request, Response } from 'express';
import { ok } from '@utils/response';
import { AnalyzeImageDto } from '../dto/analyze-image.dto';
import { imageCalorieAnalyzerService } from '../service/image-calorie-analyzer.service';
import { geminiClient } from '@config/gemini';
import { env } from '@config/env';

const TAG = '[image-calorie-analyzer/controller]';
const log = {
  info:  (...args: unknown[]) => console.log(`ℹ️  ${TAG}`, ...args),
  warn:  (...args: unknown[]) => console.warn(`⚠️  ${TAG}`, ...args),
  error: (...args: unknown[]) => console.error(`❌ ${TAG}`, ...args),
};

export const imageCalorieAnalyzerController = {

  /**
   * POST /api/image-calorie-analyzer/analyze
   * Analiza una imagen y estima calorías con Google Vision + Gemini.
   */
  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as AnalyzeImageDto;
      log.info('POST /analyze recibido', {
        tiene_base64: Boolean(payload.imagen_base64),
        tiene_url: Boolean(payload.imagen_url),
        descripcion_len: payload.descripcion_alimento?.trim().length || 0,
      });
      const result  = await imageCalorieAnalyzerService.analyze(payload);
      log.info('POST /analyze completado', {
        calorias_estimadas: result.calorias_estimadas,
        confianza_pct: result.confianza_pct,
        fuente_estimacion: result.fuente_estimacion,
      });
      ok(res, result, 'Imagen analizada correctamente');
    } catch (error) {
      log.error('POST /analyze falló', (error as Error).message);
      next(error);
    }
  },

  /**
   * GET /api/image-calorie-analyzer/health
   * Diagnóstico del módulo: muestra el estado de cada servicio de IA.
   * Útil para verificar que las API keys están correctamente configuradas.
   */
  async health(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      log.info('GET /health ejecutado');
      // ── Verificar Gemini ────────────────────────────────────────────────────
      let geminiStatus: 'ok' | 'no_key' | 'error' = 'no_key';
      let geminiError: string | null = null;
      let geminiModel = env.GEMINI_MODEL;

      if (geminiClient) {
        try {
          // Prueba mínima: solo texto, sin imagen — para verificar que la key funciona
          const model  = geminiClient.getGenerativeModel({ model: env.GEMINI_MODEL });
          const result = await model.generateContent('Responde solo con la palabra: OK');
          const text   = result.response.text().trim();
          geminiStatus = text.length > 0 ? 'ok' : 'error';
          console.log(`[health] Gemini test response: "${text}"`);
        } catch (err) {
          geminiStatus = 'error';
          geminiError  = (err as Error).message;
          console.error('[health] Gemini test falló:', geminiError);
        }
      }

      // ── Verificar Google Vision ─────────────────────────────────────────────
      const visionConfigured = !!process.env.GOOGLE_CREDENTIALS_JSON;

      log.info('Estado health evaluado', {
        gemini_configurado: !!env.GEMINI_API_KEY,
        gemini_status: geminiStatus,
        vision_configurado: visionConfigured,
      });

      // ── Respuesta ───────────────────────────────────────────────────────────
      res.status(200).json({
        success: true,
        data: {
          modulo:           'image-calorie-analyzer',
          version_code:     '2.0.0-gemini',  // ← cambia si el código nuevo está corriendo
          timestamp:        new Date().toISOString(),
          servicios: {
            gemini: {
              configurado:   !!env.GEMINI_API_KEY,
              api_key_inicio: env.GEMINI_API_KEY
                ? env.GEMINI_API_KEY.substring(0, 8) + '...'
                : null,
              modelo:        geminiModel,
              cliente_activo: geminiClient !== null,
              estado:        geminiStatus,
              error:         geminiError,
            },
            google_vision: {
              credentials_json_presente: visionConfigured,
              nota: visionConfigured
                ? 'Credenciales detectadas'
                : 'Sin GOOGLE_CREDENTIALS_JSON — Vision usará Application Default Credentials',
            },
          },
          instrucciones_si_falla: {
            gemini_no_key:    'Agrega GEMINI_API_KEY en Render → Environment Variables',
            gemini_error:     'Verifica la key en https://aistudio.google.com/app/apikey',
            vision_sin_creds: 'Agrega GOOGLE_CREDENTIALS_JSON en Render → Environment Variables',
          },
        },
      });
    } catch (error) {
      log.error('GET /health falló', (error as Error).message);
      next(error);
    }
  },

};
