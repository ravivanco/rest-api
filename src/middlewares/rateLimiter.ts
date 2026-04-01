import rateLimit from 'express-rate-limit';

/**
 * Limitador global: aplica a todas las rutas.
 * Máximo 200 peticiones por IP cada 15 minutos.
 */
export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX || '200'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: {
      code:    'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas peticiones desde esta IP. Intenta en 15 minutos.',
    },
  },
});

/**
 * Limitador estricto: solo para login y register.
 * Máximo 5 intentos por IP cada 15 minutos.
 * Los intentos exitosos NO cuentan (skipSuccessfulRequests).
 */
export const authLimiter = rateLimit({
  windowMs:               parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:                    parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
  standardHeaders:        true,
  legacyHeaders:          false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code:    'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.',
    },
  },
});