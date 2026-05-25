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

/**
 * @swagger
 * /weight-records/me:
 *   get:
 *     summary: Historial de peso del paciente (propio)
 *     tags: [Weight Records]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 30
 *     responses:
 *       200:
 *         description: Historial paginado con diferencias vs. registro anterior
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_registro_peso: 10
 *                   id_perfil: 45
 *                   fecha: "2026-05-24"
 *                   peso_kg: 82.4
 *                   created_at: "2026-05-24T14:10:00.000Z"
 *                   diferencia_vs_anterior: -0.3
 *               meta:
 *                 page: 1
 *                 limit: 30
 *                 total: 12
 *                 total_pages: 1
 */
weightRecordsRouter.get(
  '/me',
  authenticate,
  requireRole('paciente'),
  weightRecordsController.getMyHistory,
);

/**
 * @swagger
 * /weight-records/me/chart:
 *   get:
 *     summary: Serie para grafico de peso (propio)
 *     tags: [Weight Records]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           example: 30d
 *     responses:
 *       200:
 *         description: Serie de peso para grafico
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total_registros: 12
 *                 peso_inicial: 85.2
 *                 peso_actual: 82.4
 *                 variacion_total: -2.8
 *                 periodo_dias: 30
 *                 serie:
 *                   - fecha: "2026-04-25"
 *                     peso_kg: 85.2
 *                   - fecha: "2026-05-24"
 *                     peso_kg: 82.4
 */
weightRecordsRouter.get(
  '/me/chart',
  authenticate,
  requireRole('paciente'),
  weightRecordsController.getMyChart,
);

/**
 * @swagger
 * /weight-records/patient/{id}:
 *   get:
 *     summary: Historial de peso de un paciente (nutricionista)
 *     tags: [Weight Records]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 45
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 30
 *     responses:
 *       200:
 *         description: Historial paginado con diferencias vs. registro anterior
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_registro_peso: 10
 *                   id_perfil: 45
 *                   fecha: "2026-05-24"
 *                   peso_kg: 82.4
 *                   created_at: "2026-05-24T14:10:00.000Z"
 *                   diferencia_vs_anterior: -0.3
 *               meta:
 *                 page: 1
 *                 limit: 30
 *                 total: 12
 *                 total_pages: 1
 */
weightRecordsRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  weightRecordsController.getPatientHistory,
);

/**
 * @swagger
 * /weight-records/patient/{id}/chart:
 *   get:
 *     summary: Serie para grafico de peso de un paciente (nutricionista)
 *     tags: [Weight Records]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 45
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           example: 30d
 *     responses:
 *       200:
 *         description: Serie de peso para grafico
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total_registros: 12
 *                 peso_inicial: 85.2
 *                 peso_actual: 82.4
 *                 variacion_total: -2.8
 *                 periodo_dias: 30
 *                 serie:
 *                   - fecha: "2026-04-25"
 *                     peso_kg: 85.2
 *                   - fecha: "2026-05-24"
 *                     peso_kg: 82.4
 */
weightRecordsRouter.get(
  '/patient/:id/chart',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  weightRecordsController.getPatientChart,
);