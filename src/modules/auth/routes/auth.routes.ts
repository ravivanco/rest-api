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
 *   description: Registro, login y gestión de sesiones JWT
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar nuevo paciente
 *     description: |
 *       Crea una cuenta nueva para un empleado de Decokasas.
 *       **Regla RN-01:** Solo acepta correos del dominio `@decokasas.com`.
 *       No devuelve token — el usuario debe hacer login explícito.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *     responses:
 *       201:
 *         description: Paciente registrado exitosamente
 *       400:
 *         description: Datos inválidos
 *       409:
 *         description: El correo ya está registrado
 *       422:
 *         description: Correo no pertenece al dominio institucional
 *       429:
 *         description: Demasiados intentos de registro
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
 *     description: |
 *       Autentica al usuario y retorna un par de tokens JWT.
 *       - `access_token`: expira en **15 minutos**
 *       - `refresh_token`: expira en **7 días**
 *
 *       El campo `formulario_completado` indica si el paciente debe completar su perfil inicial.
 *       El campo `modulo_habilitado` indica si tiene acceso al módulo Mi Plan.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *     responses:
 *       200:
 *         description: Login exitoso
 *       400:
 *         description: JSON inválido o datos de entrada inválidos
 *       401:
 *         description: Credenciales inválidas
 *       403:
 *         description: Cuenta suspendida o inactiva
 *       429:
 *         description: Demasiados intentos de login
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
 *     description: |
 *       Usa el `refresh_token` para obtener un nuevo `access_token`.
 *       **Rotación de tokens:** el refresh token usado queda revocado
 *       y se emite uno nuevo. Guarda el nuevo refresh token.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *     responses:
 *       200:
 *         description: Nuevos tokens emitidos
 *       401:
 *         description: Refresh token inválido o expirado
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
 *     description: |
 *       Revoca el refresh token. El access token expira solo (stateless).
 *       Elimina los tokens del almacenamiento del cliente después de llamar este endpoint.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *     responses:
 *       204:
 *         description: Sesión cerrada correctamente
 *       401:
 *         description: Token requerido o inválido
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
 *     description: Retorna los datos del usuario que está en el JWT actual.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Datos del usuario
 *       401:
 *         description: Token requerido o inválido
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
 *     description: |
 *       Cambia la contraseña del usuario autenticado.
 *       **Efecto:** Revoca todas las sesiones activas en todos los dispositivos.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       401:
 *         description: Contraseña actual incorrecta
 */
authRouter.patch(
  '/change-password',
  authenticate,
  validate(ChangePasswordDto),
  authController.changePassword,
);