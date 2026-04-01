import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Valida el body de la petición contra un schema Zod.
 * Si los datos son inválidos, el errorHandler los captura y responde con 400.
 * Si son válidos, los datos son reemplazados por la versión parseada (más segura).
 *
 * Uso en rutas:
 *   router.post('/register', validate(RegisterDto), controller.register)
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // El errorHandler en app.ts capturará este ZodError y lo formateará
      next(result.error);
      return;
    }

    // Reemplazar el body con los datos validados y sanitizados
    req.body = result.data;
    next();
  };
};