import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@config/env';

/**
 * Cliente de Google Gemini.
 * Se inicializa con la GEMINI_API_KEY del entorno.
 * Si la clave no está configurada, se exporta null y los endpoints
 * que lo usen deben manejar el caso gracefully.
 */
export const geminiClient = env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
  : null;

console.log(
  `[gemini] Cliente ${geminiClient ? 'inicializado' : 'no disponible'} | `
  + `key=${env.GEMINI_API_KEY ? 'sí' : 'no'} | model=${env.GEMINI_MODEL}`,
);
