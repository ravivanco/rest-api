import { Router }           from 'express';
import { dishesController } from '../controller/dishes.controller';
import { authenticate }     from '@middlewares/authenticate';
import { requireRole }      from '@middlewares/authorize';
import { validate }         from '@middlewares/validate';
import { CreateDishDto, UpdateDishDto, UpsertIngredientDto } from '../dto/dishes.dto';

export const dishesRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Dishes
 *   description: Catálogo de platos y recetas con ingredientes y calorías calculadas
 */

/**
 * @swagger
 * /dishes:
 *   get:
 *     summary: Listar platos
 *     description: Lista todos los platos activos. Las calorías se calculan automáticamente de los ingredientes.
 *     tags: [Dishes]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de platos paginada
 */
dishesRouter.get('/',    dishesController.list);

/**
 * @swagger
 * /dishes/{id}:
 *   get:
 *     summary: Detalle de un plato con ingredientes
 *     tags: [Dishes]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plato con lista de ingredientes y calorías por ingrediente
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 plato:
 *                   id_plato: 1
 *                   nombre: Ensalada de pollo
 *                   calorias_totales: 380
 *                 ingredientes:
 *                   - nombre_alimento: Pechuga de pollo
 *                     cantidad_g: 150
 *                     calorias_aportadas: 248
 *                   - nombre_alimento: Lechuga
 *                     cantidad_g: 80
 *                     calorias_aportadas: 12
 */
dishesRouter.get('/:id', dishesController.getById);

/**
 * @swagger
 * /dishes:
 *   post:
 *     summary: Crear plato con ingredientes
 *     description: |
 *       Crea el plato y agrega sus ingredientes en una sola petición.
 *       Las `calorias_totales` se calculan automáticamente sumando los ingredientes.
 *     tags: [Dishes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             nombre: Ensalada de pollo
 *             descripcion: Ensalada fresca y proteica
 *             modo_preparacion: "1. Cocinar el pollo a la plancha..."
 *             tiempo_preparacion_min: 20
 *             ingredientes:
 *               - id_alimento: 1
 *                 cantidad_g: 150
 *               - id_alimento: 2
 *                 cantidad_g: 80
 *     responses:
 *       201:
 *         description: Plato creado con calorías calculadas
 */
dishesRouter.post(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(CreateDishDto),
  dishesController.create,
);

dishesRouter.put(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(UpdateDishDto),
  dishesController.update,
);

dishesRouter.patch(
  '/:id/status',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  dishesController.setStatus,
);

/**
 * @swagger
 * /dishes/{id}/ingredients:
 *   post:
 *     summary: Agregar o actualizar ingrediente en el plato
 *     description: Si el ingrediente ya existe, actualiza la cantidad. Recalcula calorías totales.
 *     tags: [Dishes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             id_alimento: 3
 *             cantidad_g: 100
 *     responses:
 *       200:
 *         description: Ingrediente agregado, calorías recalculadas
 */
dishesRouter.post(
  '/:id/ingredients',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(UpsertIngredientDto),
  dishesController.upsertIngredient,
);

dishesRouter.delete(
  '/:id/ingredients/:ingId',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  dishesController.removeIngredient,
);