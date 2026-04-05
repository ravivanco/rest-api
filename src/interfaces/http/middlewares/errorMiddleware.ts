import { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors/AppError';
import { ZodError } from 'zod';
import { env } from '@config/env';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Error de validación Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: err.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Error operacional conocido
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Error inesperado — nunca exponer detalles en producción
  console.error('Error inesperado:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error interno. Intenta más tarde.',
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};