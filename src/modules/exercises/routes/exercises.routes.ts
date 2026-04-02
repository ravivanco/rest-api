import { Router }              from 'express';
import { exercisesController } from '../controller/exercises.controller';
import { authenticate }        from '@middlewares/authenticate';
import { requireRole }         from '@middlewares/authorize';
import { validate }            from '@middlewares/validate';
import { CreateExerciseDto, UpdateExerciseDto } from '../dto/exercises.dto';

export const exercisesRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Exercises
 *   description: Catálogo de ejercicios físicos con parámetros de prescripción
 */

/**
 * @swagger
 * /exercises:
 *   get:
 *     summary: Listar ejercicios con filtros
 *     tags: [Exercises]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: intensidad
 *         schema: { type: string, enum: [baja, media, alta] }
 *       - in: query
 *         name: nivel_actividad_recomendado
 *         schema: { type: string, enum: [sedentario, bajo, medio, alto] }
 *       - in: query
 *         name: categoria
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de ejercicios paginada
 */
exercisesRouter.get('/',    exercisesController.list);
exercisesRouter.get('/:id', exercisesController.getById);

/**
 * @swagger
 * /exercises:
 *   post:
 *     summary: Crear ejercicio
 *     tags: [Exercises]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             nombre: Caminata rápida
 *             descripcion: Caminata a paso acelerado en superficie plana
 *             categoria: Cardiovascular
 *             duracion_min: 30
 *             frecuencia_semanal: 5
 *             intensidad: baja
 *             nivel_actividad_recomendado: sedentario
 *             objetivo_recomendado: Reducir mi peso corporal
 *     responses:
 *       201:
 *         description: Ejercicio creado
 */
exercisesRouter.post(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(CreateExerciseDto),
  exercisesController.create,
);

exercisesRouter.put(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  validate(UpdateExerciseDto),
  exercisesController.update,
);

exercisesRouter.patch(
  '/:id/status',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  exercisesController.setStatus,
);