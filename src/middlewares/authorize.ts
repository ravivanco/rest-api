import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '@errors/AppError';
import { Role } from '@types/common.types';

/**
 * Verifica que el usuario tenga el rol requerido para acceder a la ruta.
 * SIEMPRE debe usarse DESPUÉS de authenticate.
 *
 * Uso en rutas:
 *   router.get('/ruta', authenticate, requireRole('nutricionista'), controller.metodo)
 *   router.get('/ruta', authenticate, requireRole('paciente', 'nutricionista'), controller.metodo)
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {

    // Si no hay usuario es porque authenticate no se ejecutó primero
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    // Verificar si el rol del usuario está en la lista de roles permitidos
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(
        `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`
      ));
      return;
    }

    next();
  };
};