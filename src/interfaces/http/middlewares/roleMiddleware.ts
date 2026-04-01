import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '@shared/errors/AppError';
import { Role } from '@shared/constants/roles';

export const requireRole = (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(`Se requiere el rol: ${roles.join(' o ')}`)
      );
    }

    next();
  };