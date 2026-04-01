import { Request, Response, NextFunction } from 'express';
import { authService } from '../service/auth.service';
import { ok, created, noContent } from '@utils/response';
import { RegisterDto, LoginDto, RefreshTokenDto, LogoutDto, ChangePasswordDto } from '../dto/auth.dto';

/**
 * Controller de autenticación.
 * Recibe el request, llama al service y envía la respuesta.
 * Sin lógica de negocio aquí.
 */
export const authController = {

  /**
   * POST /api/auth/register
   * Registra un nuevo paciente.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // El body ya fue validado por el middleware validate(RegisterDto)
      const data = req.body as RegisterDto;
      const result = await authService.register(data);
      created(res, result, 'Registro exitoso. Ahora puedes iniciar sesión.');
    } catch (error) {
      next(error);
    }
  },


  /**
   * POST /api/auth/login
   * Inicia sesión y devuelve los tokens JWT.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as LoginDto;
      const result = await authService.login(data);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },


  /**
   * POST /api/auth/refresh
   * Renueva el access token usando el refresh token.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refresh_token } = req.body as RefreshTokenDto;
      const result = await authService.refreshToken(refresh_token);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },


  /**
   * POST /api/auth/logout
   * Cierra la sesión revocando el refresh token.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refresh_token } = req.body as LogoutDto;
      await authService.logout(refresh_token);
      noContent(res);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/auth/me
   * Devuelve los datos del usuario autenticado (desde el JWT).
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.user viene del middleware authenticate
      ok(res, {
        id:        req.user!.id,
        email:     req.user!.email,
        role:      req.user!.role,
        id_perfil: req.user!.id_perfil,
        estado:    req.user!.estado,
      });
    } catch (error) {
      next(error);
    }
  },


  /**
   * PATCH /api/auth/change-password
   * Cambia la contraseña del usuario autenticado.
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contrasena_actual, contrasena_nueva } = req.body as ChangePasswordDto;
      await authService.changePassword(req.user!.id, contrasena_actual, contrasena_nueva);
      ok(res, null, 'Contraseña actualizada. Inicia sesión nuevamente en todos tus dispositivos.');
    } catch (error) {
      next(error);
    }
  },

};