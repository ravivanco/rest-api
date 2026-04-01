import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@errors/AppError';

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

  // Error inesperado — nunca exponer detalles internos en producción
  console.error('Error no controlado:', err);

  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno. Por favor intenta más tarde.',
      // Solo mostrar el detalle en desarrollo
      ...(process.env.NODE_ENV === 'development' && {
        debug: err.message,
      }),
    },
  });
};