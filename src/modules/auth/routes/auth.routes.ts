import { Router } from 'express';
import { authController }  from '../controller/auth.controller';
import { authenticate }    from '@middlewares/authenticate';
import { validate }        from '@middlewares/validate';
import { authLimiter }     from '@middlewares/rateLimiter';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  ChangePasswordDto,
} from '../dto/auth.dto';

export const authRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticación
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo paciente
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Paciente registrado exitosamente
 */
authRouter.post(
  '/register',
  authLimiter,
  validate(RegisterDto),
  authController.register,
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 */
authRouter.post(
  '/login',
  authLimiter,
  validate(LoginDto),
  authController.login,
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nuevos tokens emitidos
 */
authRouter.post(
  '/refresh',
  validate(RefreshTokenDto),
  authController.refresh,
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       204:
 *         description: Sesión cerrada correctamente
 */
authRouter.post(
  '/logout',
  authenticate,
  validate(LogoutDto),
  authController.logout,
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Datos del usuario autenticado
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Datos del usuario
 */
authRouter.get(
  '/me',
  authenticate,
  authController.me,
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Cambiar contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contrasena_actual, contrasena_nueva]
 *             properties:
 *               contrasena_actual:
 *                 type: string
 *               contrasena_nueva:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 */
authRouter.patch(
  '/change-password',
  authenticate,
  validate(ChangePasswordDto),
  authController.changePassword,
);