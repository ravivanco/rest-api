import { Router } from 'express';
import { authenticate } from '@middlewares/authenticate';
import { requireRole } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { adminController } from '../controller/admin.controller';
import {
  AdminResetPasswordDto,
  CreateNutritionistDto,
  UpdateAdminUserDto,
  UpdateAdminUserStatusDto,
} from '../dto/admin.dto';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('administrador'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Gestión administrativa de usuarios del sistema
 */

/**
 * @swagger
 * /admin/activity-logs:
 *   get:
 *     summary: Historial de actividad del administrador
 *     description: Lista las acciones realizadas en el panel administrativo con filtros por rol, búsqueda y rango de fechas.
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [administrador, nutricionista, paciente]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Historial de actividad paginado
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_actividad: 1
 *                   usuario: admin@dkfitt.com
 *                   rol: administrador
 *                   accion: Creó cuenta de nutricionista
 *                   ip: 192.168.1.100
 *                   fecha: "2026-03-27T08:30:00.000Z"
 *               meta:
 *                 page: 1
 *                 limit: 20
 *                 total: 125
 *                 total_pages: 7
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
adminRouter.get('/activity-logs', adminController.listActivityLogs);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Listar usuarios para panel administrativo
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [administrador, nutricionista, paciente]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [activo, inactivo, suspendido]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [fecha_registro, nombres, rol]
 *           default: fecha_registro
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Listado paginado de usuarios
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
adminRouter.get('/users', adminController.listUsers);

/**
 * @swagger
 * /admin/nutritionists:
 *   post:
 *     summary: Crear cuenta de nutricionista
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo_institucional
 *               - nombres
 *               - apellidos
 *               - edad
 *               - sexo
 *               - fecha_nacimiento
 *               - perfil_nutricionista
 *             properties:
 *               correo_institucional:
 *                 type: string
 *                 format: email
 *               contrasena_temporal:
 *                 type: string
 *                 description: Opcional. Si no se envia, el backend genera una contrasena temporal segura.
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               edad:
 *                 type: integer
 *               sexo:
 *                 type: string
 *                 enum: [M, F, O]
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *               perfil_nutricionista:
 *                 type: object
 *                 required: [numero_registro_profesional]
 *                 properties:
 *                   numero_registro_profesional:
 *                     type: string
 *                   especialidad:
 *                     type: string
 *                     nullable: true
 *                   telefono_contacto:
 *                     type: string
 *                     nullable: true
 *                   foto_perfil_url:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   horario_atencion:
 *                     type: object
 *                     nullable: true
 *     responses:
 *       201:
 *         description: Nutricionista creada correctamente. Incluye contrasena_temporal para copiarla una sola vez.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
adminRouter.post(
  '/nutritionists',
  validate(CreateNutritionistDto),
  adminController.createNutritionist,
);

/**
 * @swagger
 * /admin/nutritionists/{id}:
 *   get:
 *     summary: Obtener informacion de una nutricionista
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Informacion de la nutricionista
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
adminRouter.get('/nutritionists/:id', adminController.getNutritionistDetail);

/**
 * @swagger
 * /admin/nutritionists/{id}:
 *   patch:
 *     summary: Editar datos completos de una nutricionista
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               correo_institucional:
 *                 type: string
 *                 format: email
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *               sexo:
 *                 type: string
 *                 enum: [M, F, O]
 *               perfil_nutricionista:
 *                 type: object
 *                 properties:
 *                   numero_registro_profesional:
 *                     type: string
 *                   especialidad:
 *                     type: string
 *                     nullable: true
 *                   telefono_contacto:
 *                     type: string
 *                     nullable: true
 *     responses:
 *       200:
 *         description: Nutricionista actualizada correctamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
adminRouter.patch(
  '/nutritionists/:id',
  validate(UpdateAdminUserDto),
  adminController.updateNutritionistFull,
);

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: Editar datos permitidos de usuario
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombres:
 *                 type: string
 *               apellidos:
 *                 type: string
 *               correo_institucional:
 *                 type: string
 *                 format: email
 *               edad:
 *                 type: integer
 *               sexo:
 *                 type: string
 *                 enum: [M, F, O]
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *               perfil_nutricionista:
 *                 type: object
 *                 properties:
 *                   numero_registro_profesional:
 *                     type: string
 *                   especialidad:
 *                     type: string
 *                     nullable: true
 *                   telefono_contacto:
 *                     type: string
 *                     nullable: true
 *                   foto_perfil_url:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   horario_atencion:
 *                     type: object
 *                     nullable: true
 *     responses:
 *       200:
 *         description: Usuario actualizado correctamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
adminRouter.patch(
  '/users/:id',
  validate(UpdateAdminUserDto),
  adminController.updateUser,
);

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Cambiar estado de cuenta de un usuario
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [activo, inactivo, suspendido]
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
adminRouter.patch(
  '/users/:id/status',
  validate(UpdateAdminUserStatusDto),
  adminController.updateUserStatus,
);

/**
 * @swagger
 * /admin/users/{id}/reset-password:
 *   post:
 *     summary: Resetear contraseña de un usuario e invalidar sesiones
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contrasena_temporal:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña reseteada. Incluye contrasena_temporal para copiarla una sola vez.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
adminRouter.post(
  '/users/:id/reset-password',
  validate(AdminResetPasswordDto),
  adminController.resetPassword,
);
