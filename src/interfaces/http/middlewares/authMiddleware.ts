import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { UnauthorizedError } from '@shared/errors/AppError';
import { Role } from '@shared/constants/roles';

interface JwtPayload {
  sub: number;
  email: string;
  role: Role;
  id_perfil: number | null;
  estado: string;
  iat: number;
  exp: number;
}

const isJwtPayload = (payload: unknown): payload is JwtPayload => {
  if (!payload || typeof payload !== 'object') return false;

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.sub === 'number' &&
    typeof candidate.email === 'string' &&
    typeof candidate.role === 'string' &&
    (typeof candidate.id_perfil === 'number' || candidate.id_perfil === null) &&
    typeof candidate.estado === 'string'
  );
};

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!isJwtPayload(decoded)) {
      throw new UnauthorizedError('Token inválido');
    }

    const payload = decoded;

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      id_perfil: payload.id_perfil,
      estado: payload.estado,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expirado'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido'));
    } else {
      next(error);
    }
  }
};