import { Router }                   from 'express';
import { weightRecordsController }  from '../controller/weight-records.controller';
import { authenticate }             from '@middlewares/authenticate';
import { requireRole }              from '@middlewares/authorize';
import { validate }                 from '@middlewares/validate';
import { CreateWeightRecordDto }    from '../dto/weight-records.dto';

export const weightRecordsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Weight Records
 *   description: Registro diario de peso — app móvil y consulta web
 */

/**
 * @swagger
 * /weight-records:
 *   post:
 *     summary: Registrar peso del día
 *     description: |
 *       El paciente registra su peso con báscula convencional.
 *       Solo se permite **un registro por día**.
 *       La respuesta incluye la diferencia vs. ayer y vs. el peso inicial.
 *     tags: [Weight Records]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             peso_kg: 83.8
 *     responses:
 *       201:
 *         description: Peso registrado con diferencias calculadas
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id_registro_peso: 5
 *                 fecha: "2026-04-07"
 *                 peso_kg: 83.8
 *                 diferencia_vs_ayer: -0.7
 *                 diferencia_vs_inicio: -4.2
 *                 es_primer_registro: false
 *       409:
 *         description: Ya registraste tu peso hoy
 */
weightRecordsRouter.post(
  '/',
  authenticate,
  requireRole('paciente'),
  validate(CreateWeightRecordDto),
  weightRecordsController.create,
);

weightRecordsRouter.get(
  '/me',
  authenticate,
  requireRole('paciente'),
  weightRecordsController.getMyHistory,
);

weightRecordsRouter.get(
  '/me/chart',
  authenticate,
  requireRole('paciente'),
  weightRecordsController.getMyChart,
);

weightRecordsRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  weightRecordsController.getPatientHistory,
);

weightRecordsRouter.get(
  '/patient/:id/chart',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  weightRecordsController.getPatientChart,
);