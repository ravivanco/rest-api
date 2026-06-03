import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@errors/AppError';
import { env } from '@config/env';

interface PgErrorLike {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
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
    const detail = err.detail ?? '';
    const isReferencedByOtherRows =
      detail.includes('is still referenced from table')
      || detail.includes('todavÃ­a es referenciada desde la tabla')
      || detail.includes('todavia es referenciada desde la tabla');

    if (isReferencedByOtherRows) {
      res.status(422).json({
        success: false,
        error: {
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'No se puede eliminar el recurso porque todavia esta referenciado por otros datos del sistema.',
          details: {
            constraint: err.constraint,
            table: err.table,
            reason: 'RESOURCE_IN_USE',
          },
        },
      });
      return;
    }

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

  
   // ── Error de Multer (subida de archivos) ──────────────────
  if (err.name === 'MulterError') {
    const multerMessages: Record<string, string> = {
      LIMIT_FILE_SIZE:      'El archivo es demasiado grande. Máximo 5MB.',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivo inesperado. Usa el campo "image".',
      LIMIT_FILE_COUNT:     'Solo se permite subir un archivo a la vez.',
    };

    res.status(400).json({
      success: false,
      error: {
        code:    'FILE_UPLOAD_ERROR',
        message: multerMessages[(err as NodeJS.ErrnoException).code ?? '']
          ?? 'Error al procesar el archivo',
      },
    });
    return;
  }

  // ── Error de tipo de archivo (fileFilter) ─────────────────
  if (err.message?.includes('Tipo de archivo no permitido')) {
    res.status(400).json({
      success: false,
      error: {
        code:    'INVALID_FILE_TYPE',
        message: err.message,
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
