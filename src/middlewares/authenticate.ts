import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@errors/AppError';
import { Role } from '@shared/constants/roles';

/**
 * Verifica el JWT en cada petición protegida.
 * Si el token es válido, adjunta los datos del usuario en req.user.
 * Si es inválido o expirado, lanza UnauthorizedError.
 *
 * Uso en rutas:
 *   router.get('/ruta', authenticate, controller.metodo)
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    // Swagger puede enviar "Bearer <token>", "bearer <token>" o incluso duplicar "Bearer ".
    // Normalizamos para reducir falsos 401 por formato del header.
    if (!authHeader) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    let token = authHeader.trim();

    if (/^bearer\s+/i.test(token)) {
      token = token.replace(/^bearer\s+/i, '').trim();
    }

    if (/^bearer\s+/i.test(token)) {
      token = token.replace(/^bearer\s+/i, '').trim();
    }

    if (!token) {
      throw new UnauthorizedError('Token de acceso requerido');
    }

    // Verificar firma y expiración
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as {
      sub:       number;
      email:     string;
      role:      Role;
      id_perfil: number | null;
      estado:    string;
      requiere_cambio_contrasena: boolean;
    };

    // Verificar que la cuenta sigue activa
    if (payload.estado !== 'activo') {
      throw new UnauthorizedError('Tu cuenta está suspendida o inactiva');
    }

    // Adjuntar datos del usuario para uso en controllers
    const requiereCambio =
      typeof payload.requiere_cambio_contrasena === 'boolean'
        ? payload.requiere_cambio_contrasena
        : false;

    req.user = {
      id:        payload.sub,
      email:     payload.email,
      role:      payload.role,
      id_perfil: payload.id_perfil,
      estado:    payload.estado,
      requiere_cambio_contrasena: requiereCambio,
    };

    next();

  } catch (error) {
    // Diferenciar token expirado de token inválido
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expirado. Usa el refresh token para renovarlo'));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido'));
      return;
    }
    next(error);
  }
};

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    let token = authHeader.trim();
    if (/^bearer\s+/i.test(token)) {
      token = token.replace(/^bearer\s+/i, '').trim();
    }

    if (/^bearer\s+/i.test(token)) {
      token = token.replace(/^bearer\s+/i, '').trim();
    }

    if (!token) {
      return next();
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as {
      sub:       number;
      email:     string;
      role:      Role;
      id_perfil: number | null;
      estado:    string;
      requiere_cambio_contrasena: boolean;
    };

    if (payload.estado === 'activo') {
      const requiereCambio =
        typeof payload.requiere_cambio_contrasena === 'boolean'
          ? payload.requiere_cambio_contrasena
          : false;

      req.user = {
        id:        payload.sub,
        email:     payload.email,
        role:      payload.role,
        id_perfil: payload.id_perfil,
        estado:    payload.estado,
        requiere_cambio_contrasena: requiereCambio,
      };
    }
    next();
  } catch {
    next();
  }
};