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
 *           schema:
 *             type: object
 *             required: [correo_institucional, contrasena, nombres, apellidos, edad, sexo, fecha_nacimiento]
 *             properties:
 *               correo_institucional:
 *                 type: string
 *                 example: juan.perez@decokasas.com
 *               contrasena:
 *                 type: string
 *                 example: "MiClave123!"
 *                 description: Mínimo 8 chars, mayúscula, minúscula, número y carácter especial
 *               nombres:
 *                 type: string
 *                 example: Juan
 *               apellidos:
 *                 type: string
 *                 example: Pérez
 *               edad:
 *                 type: integer
 *                 example: 32
 *               sexo:
 *                 type: string
 *                 enum: [M, F, O]
 *                 example: M
 *               fecha_nacimiento:
 *                 type: string
 *                 example: "1992-05-15"
 *     responses:
 *       201:
 *         description: Paciente registrado exitosamente
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id_usuario: 14
 *                 correo_institucional: juan.perez@decokasas.com
 *                 nombres: Juan
 *                 apellidos: Pérez
 *                 rol: paciente
 *                 formulario_completado: false
 *               message: Registro exitoso. Ahora puedes iniciar sesión.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
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
 *           schema:
 *             type: object
 *             required: [correo_institucional, contrasena]
 *             properties:
 *               correo_institucional:
 *                 type: string
 *                 format: email
 *               contrasena:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login exitoso
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
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiJ9...
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
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       204:
 *         description: Sesión cerrada correctamente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 14
 *                 email: juan.perez@decokasas.com
 *                 role: paciente
 *                 id_perfil: 8
 *                 estado: activo
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
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
 *           schema:
 *             type: object
 *             required: [contrasena_actual, contrasena_nueva]
 *             properties:
 *               contrasena_actual:
 *                 type: string
 *                 example: "MiClave123!"
 *               contrasena_nueva:
 *                 type: string
 *                 example: "NuevaClave456@"
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