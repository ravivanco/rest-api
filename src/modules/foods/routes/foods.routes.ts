import { Router }          from 'express';
import { foodsController } from '../controller/foods.controller';
import { authenticate, optionalAuthenticate } from '@middlewares/authenticate';
import { requireRole }     from '@middlewares/authorize';
import { validate }        from '@middlewares/validate';
import { CreateFoodDto, UpdateFoodDto, CreateCustomFoodDto } from '../dto/foods.dto';

export const foodsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Foods
 *   description: Catálogo de alimentos con información nutricional por 100g
 */

/**
 * @swagger
 * /foods:
 *   get:
 *     summary: Listar alimentos con filtros
 *     tags: [Foods]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por nombre
 *       - in: query
 *         name: categoria
 *         schema: { type: string, enum: [proteinas,carbohidratos,lacteos,vegetales,frutas,grasas,otros] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de alimentos paginada
 */
foodsRouter.get('/', optionalAuthenticate, foodsController.list);

/**
 * @swagger
 * /foods/custom:
 *   post:
 *     summary: Crear alimento personalizado (Móvil Paciente)
 *     tags: [Foods]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, categoria]
 *             properties:
 *               nombre: { type: string }
 *               categoria: { type: string }
 *     responses:
 *       201:
 *         description: Alimento personalizado creado
 */
foodsRouter.post(
  '/custom',
  authenticate,
  requireRole('paciente', 'nutricionista'),
  validate(CreateCustomFoodDto),
  foodsController.createCustom,
);

foodsRouter.get('/:id', foodsController.getById);

/**
 * @swagger
 * /foods:
 *   post:
 *     summary: Crear alimento
 *     tags: [Foods]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             nombre: Pechuga de pollo
 *             categoria: proteinas
 *             calorias_por_100g: 165
 *             carbohidratos_g: 0
 *             proteinas_g: 31
 *             grasas_g: 3.6
 *             vitaminas: "B3, B6"
 *             minerales: "Fósforo, Selenio"
 *     responses:
 *       201:
 *         description: Alimento creado
 *       409:
 *         description: El alimento ya existe
 */
foodsRouter.post(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(CreateFoodDto),
  foodsController.create,
);

foodsRouter.put(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(UpdateFoodDto),
  foodsController.update,
);

foodsRouter.patch(
  '/:id/status',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  foodsController.setStatus,
);