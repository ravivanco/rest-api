import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@errors/AppError';
import { env } from '@config/env';

interface PgErrorLike {
  code?: string;
}

const isPgError = (error: unknown): error is PgErrorLike => {
  return typeof error === 'object' && error !== null && 'code' in error;
};

/**
 * Middleware global de manejo de errores.
 * DEBE ser el último middleware registrado en app.ts.
 * Captura cualquier error lanzado en la aplicación y
 * lo convierte en una respuesta JSON estructurada.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {

  // Error de validación de Zod (body mal formado)
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code:    'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: err.issues.map(e => ({
          field:   e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Error operacional conocido (AppError y sus subclases)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
        message: err.message,
      },
    });
    return;
  }

  // Errores comunes de PostgreSQL convertidos a respuestas funcionales
  if (isPgError(err) && err.code === '23503') {
    res.status(422).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Uno o más IDs enviados no existen en el catálogo.',
      },
    });
    return;
  }

  if (isPgError(err) && err.code === '23505') {
    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'El recurso que intentas guardar ya existe.',
      },
    });
    return;
  }

  if (isPgError(err) && (err.code === '23514' || err.code === '22P02')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no cumplen el formato esperado.',
      },
    });
    return;
  }

  // ── Error inesperado — NUNCA exponer detalles en producción ──
  console.error('❌ Error no controlado:', {
    name:    err.name,
    message: err.message,
    // Stack solo en desarrollo — NUNCA en producción
    stack:   env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno. Por favor intenta más tarde.',
      // Debug solo en desarrollo
      ...(env.NODE_ENV === 'development' && {
        debug: { name: err.name, message: err.message },
      }),
    },
  });
};