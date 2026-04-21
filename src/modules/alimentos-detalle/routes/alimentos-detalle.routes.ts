import { Router } from 'express';
import { authenticate } from '@middlewares/authenticate';
import { requireRole } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import {
  CreateAlimentoDetalleDto,
  UpdateAlimentoDetalleDto,
} from '../dto/alimentos-detalle.dto';
import { alimentosDetalleController } from '../controller/alimentos-detalle.controller';

export const alimentosDetalleRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Alimentos Detalle
 *   description: CRUD de alimentos_detalle con informacion nutricional extendida
 */

/**
 * @swagger
 * /alimentos-detalle:
 *   get:
 *     summary: Listar alimentos detalle
 *     tags: [Alimentos Detalle]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Busqueda opcional por nombre
 *       - in: query
 *         name: categoria
 *         schema: { type: string }
 *         description: Filtro opcional por categoria
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Lista paginada de alimentos detalle
 */
alimentosDetalleRouter.get('/', alimentosDetalleController.list);

/**
 * @swagger
 * /alimentos-detalle/{id}:
 *   get:
 *     summary: Obtener alimento detalle por ID
 *     tags: [Alimentos Detalle]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalle nutricional completo del alimento
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
alimentosDetalleRouter.get('/:id', alimentosDetalleController.getById);

/**
 * @swagger
 * /alimentos-detalle:
 *   post:
 *     summary: Crear un alimento detalle
 *     tags: [Alimentos Detalle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             nombre: Avena en hojuelas
 *             categoria: cereales
 *             calorias: 389
 *             proteinas: 16.9
 *             grasas: 6.9
 *             carbohidratos: 66.3
 *             fibra: 10.6
 *             ags: 1.2
 *             agm: 2.2
 *             agpi: 2.5
 *             colesterol: 0
 *             calcio: 54
 *             fosforo: 410
 *             hierro: 4.7
 *             potasio: 429
 *             sodio: 2
 *             zinc: 3.6
 *             vitamina_c: 0
 *             vitamina_a: 0
 *             folatos: 56
 *             vitamina_b12: 0
 *             fuente: csv_usda_2026
 *     responses:
 *       201:
 *         description: Alimento detalle creado
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
alimentosDetalleRouter.post(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(CreateAlimentoDetalleDto),
  alimentosDetalleController.create,
);

/**
 * @swagger
 * /alimentos-detalle/{id}:
 *   patch:
 *     summary: Actualizar un alimento detalle
 *     tags: [Alimentos Detalle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             calorias: 395
 *             fibra: 11.2
 *             fuente: csv_ajustado_2026
 *     responses:
 *       200:
 *         description: Alimento detalle actualizado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
alimentosDetalleRouter.patch(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(UpdateAlimentoDetalleDto),
  alimentosDetalleController.update,
);

/**
 * @swagger
 * /alimentos-detalle/{id}:
 *   delete:
 *     summary: Eliminar un alimento detalle
 *     tags: [Alimentos Detalle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Alimento detalle eliminado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
alimentosDetalleRouter.delete(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  alimentosDetalleController.remove,
);
