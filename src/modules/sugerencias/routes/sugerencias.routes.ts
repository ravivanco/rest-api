import { Router } from 'express';
import { authenticate } from '@middlewares/authenticate';
import { requireRole } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { sugerenciasController } from '../controller/sugerencias.controller';
import { ReviewSuggestionSchema } from '../dto/sugerencia.dto';

export const sugerenciasRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Sugerencias
 *   description: Gestión de sugerencias automáticas de receta
 */

/**
 * @swagger
 * /sugerencias:
 *   get:
 *     summary: Listar sugerencias de recetas
 *     tags: [Sugerencias]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, aprobada, rechazada]
 *       - in: query
 *         name: id_perfil
 *         schema:
 *           type: integer
 *       - in: query
 *         name: id_plan
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Listado de sugerencias
 */
sugerenciasRouter.get(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  sugerenciasController.list,
);

/**
 * @swagger
 * /sugerencias/{id}:
 *   patch:
 *     summary: Aprobar o rechazar una sugerencia
 *     tags: [Sugerencias]
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
 *             required: [accion, id_nutricionista]
 *             properties:
 *               accion:
 *                 type: string
 *                 enum: [aprobar, rechazar]
 *               id_nutricionista:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Sugerencia revisada
 *       400:
 *         description: Acción inválida
 *       404:
 *         description: Sugerencia no encontrada
 *       409:
 *         description: Sugerencia ya revisada
 */
sugerenciasRouter.patch(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(ReviewSuggestionSchema),
  sugerenciasController.review,
);
