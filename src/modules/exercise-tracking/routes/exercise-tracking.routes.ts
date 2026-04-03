import { Router }                     from 'express';
import { exerciseTrackingController } from '../controller/exercise-tracking.controller';
import { authenticate }               from '@middlewares/authenticate';
import { requireRole }                from '@middlewares/authorize';
import { validate }                   from '@middlewares/validate';
import { TrackExerciseDto }           from '../dto/exercise-tracking.dto';

export const exerciseTrackingRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Exercise Tracking
 *   description: Seguimiento diario de ejercicios — app móvil
 */

/**
 * @swagger
 * /exercise-tracking/today:
 *   get:
 *     summary: Ejercicios del día con estado de cumplimiento
 *     tags: [Exercise Tracking]
 *     responses:
 *       200:
 *         description: Ejercicios del día con resumen de cumplimiento
 */
exerciseTrackingRouter.get(
  '/today',
  authenticate,
  requireRole('paciente'),
  exerciseTrackingController.getToday,
);

/**
 * @swagger
 * /exercise-tracking:
 *   post:
 *     summary: Marcar ejercicio como completado o no completado
 *     description: |
 *       Igual que meal-tracking, aplica **RN-03**: solo en el día actual.
 *     tags: [Exercise Tracking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             id_ejercicio_diario: 3
 *             completado: true
 *             hora_registro: "07:00"
 *     responses:
 *       200:
 *         description: Seguimiento guardado
 *       422:
 *         description: Solo puedes registrar en el día actual (RN-03)
 */
exerciseTrackingRouter.post(
  '/',
  authenticate,
  requireRole('paciente'),
  validate(TrackExerciseDto),
  exerciseTrackingController.trackExercise,
);

exerciseTrackingRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  exerciseTrackingController.getPatientHistory,
);