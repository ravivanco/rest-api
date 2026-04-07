import rateLimit from 'express-rate-limit';
import { env }   from '@config/env';

/** Respuesta estándar cuando se excede el límite */
const limitResponse = (code: string, message: string) => ({
  success: false,
  error: { code, message },
});

/**
 * Limitador global: todas las rutas.
 * 200 peticiones por IP cada 15 minutos.
 */
export const globalLimiter = rateLimit({
  windowMs:        env.RATE_LIMIT_WINDOW_MS,
  max:             env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         limitResponse(
    'RATE_LIMIT_EXCEEDED',
    'Demasiadas peticiones. Intenta en 15 minutos.',
  ),
});

/**
 * Limitador estricto: login y register.
 * 5 intentos por IP cada 15 minutos.
 * Los intentos exitosos NO cuentan.
 */
export const authLimiter = rateLimit({
  windowMs:               env.RATE_LIMIT_WINDOW_MS,
  max:                    env.AUTH_RATE_LIMIT_MAX,
  standardHeaders:        true,
  legacyHeaders:          false,
  skipSuccessfulRequests: true,
  message:                limitResponse(
    'AUTH_RATE_LIMIT_EXCEEDED',
    'Demasiados intentos. Espera 15 minutos.',
  ),
});

/**
 * Limitador para subida de imágenes (consumo adicional).
 * 10 imágenes por usuario por minuto.
 */
export const uploadLimiter = rateLimit({
  windowMs:        60_000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         limitResponse(
    'UPLOAD_RATE_LIMIT_EXCEEDED',
    'Límite de imágenes alcanzado. Intenta en 1 minuto.',
  ),
});