import { Router } from 'express';
import { authenticate } from '@middlewares/authenticate';
import { requireRole } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { menusDiariosController } from '../controller/menus-diarios.controller';
import { UpdateMenuPlatoSchema } from '../dto/update-plato.dto';

export const menusDiariosRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Menus Diarios
 *   description: Gestión de menús diarios y reemplazo de platos
 */

/**
 * @swagger
 * /menus-diarios/{id}:
 *   get:
 *     summary: Obtener detalle de un menú diario
 *     tags: [Menus Diarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Menú diario con plato e ingredientes
 *       404:
 *         description: Menú diario no encontrado
 */
menusDiariosRouter.get(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  menusDiariosController.getById,
);

/**
 * @swagger
 * /menus-diarios/{id}/plato:
 *   patch:
 *     summary: Reemplazar el plato de un menú diario
 *     tags: [Menus Diarios]
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
 *             required: [id_plato]
 *             properties:
 *               id_plato:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Plato del menú reemplazado
 *       400:
 *         description: El plato no coincide con el tiempo de comida
 *       404:
 *         description: Menú o plato no encontrado
 *       409:
 *         description: El plan no se puede modificar
 */
menusDiariosRouter.patch(
  '/:id/plato',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(UpdateMenuPlatoSchema),
  menusDiariosController.replacePlato,
);
