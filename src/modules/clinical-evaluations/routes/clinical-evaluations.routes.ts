import { Router }                           from 'express';
import { clinicalEvaluationsController }    from '../controller/clinical-evaluations.controller';
import { authenticate }                     from '@middlewares/authenticate';
import { requireRole }                      from '@middlewares/authorize';
import { validate }                         from '@middlewares/validate';
import { CreateEvaluationDto }              from '../dto/clinical-evaluations.dto';

export const clinicalEvaluationsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Clinical Evaluations
 *   description: Evaluaciones de bioimpedancia registradas por la nutricionista
 */

/**
 * @swagger
 * /clinical-evaluations:
 *   post:
 *     summary: Registrar nueva evaluación clínica
 *     description: |
 *       La nutricionista registra los datos de bioimpedancia del paciente.
 *
 *       **Cálculos automáticos:**
 *       - **IMC** → calculado por PostgreSQL con la fórmula peso / (altura/100)²
 *       - **Calorías diarias** → calculadas con la fórmula Mifflin-St Jeor × factor de actividad
 *       - **Distribución de macros** → según el objetivo del paciente
 *
 *       El paciente debe tener su formulario inicial completado.
 *     tags: [Clinical Evaluations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             id_perfil: 8
 *             peso_kg: 84.5
 *             altura_cm: 175.0
 *             porcentaje_grasa: 28.4
 *             masa_muscular_kg: 35.2
 *             agua_corporal_pct: 52.1
 *             grasa_visceral: 8
 *             masa_osea_kg: 3.1
 *             tmb_kcal: 1720
 *             otros_indicadores:
 *               edad_metabolica: 30
 *             fecha_evaluacion: "2026-04-01"
 *     responses:
 *       201:
 *         description: Evaluación registrada con cálculos automáticos
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id_evaluacion: 1
 *                 peso_kg: 84.5
 *                 altura_cm: 175.0
 *                 imc: 27.59
 *                 calorias_diarias_calculadas: 2190
 *                 distribucion_carbohidratos_pct: 40
 *                 distribucion_proteinas_pct: 35
 *                 distribucion_grasas_pct: 25
 *                 diferencias_vs_anterior: null
 *                 es_primera_evaluacion: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: Perfil del paciente no encontrado
 *       422:
 *         description: El paciente no ha completado su formulario inicial
 */
clinicalEvaluationsRouter.post(
  '/',
  authenticate,
  requireRole('nutricionista'),
  validate(CreateEvaluationDto),
  clinicalEvaluationsController.create,
);

/**
 * @swagger
 * /clinical-evaluations/me/history:
 *   get:
 *     summary: Historial propio del paciente
 *     description: El paciente consulta su propio historial de evaluaciones desde la app móvil.
 *     tags: [Clinical Evaluations]
 *     responses:
 *       200:
 *         description: Lista de evaluaciones con diferencias entre cada una
 */
clinicalEvaluationsRouter.get(
  '/me/history',
  authenticate,
  requireRole('paciente'),
  clinicalEvaluationsController.getMyHistory,
);

/**
 * @swagger
 * /clinical-evaluations/patient/{id}:
 *   get:
 *     summary: Historial de evaluaciones de un paciente
 *     description: La nutricionista consulta el historial completo de un paciente. El `id` es el `id_perfil`.
 *     tags: [Clinical Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *     responses:
 *       200:
 *         description: Historial de evaluaciones ordenado por fecha descendente
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
clinicalEvaluationsRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  clinicalEvaluationsController.getPatientHistory,
);

/**
 * @swagger
 * /clinical-evaluations/patient/{id}/compare:
 *   get:
 *     summary: Comparar dos evaluaciones
 *     description: |
 *       Compara dos evaluaciones del paciente mostrando diferencias absolutas y porcentuales.
 *       Envía los IDs de las dos evaluaciones en el query param `evaluation_ids`.
 *     tags: [Clinical Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *       - in: query
 *         name: evaluation_ids
 *         required: true
 *         schema: { type: string }
 *         example: "3,7"
 *         description: IDs de las dos evaluaciones separados por coma
 *     responses:
 *       200:
 *         description: Comparación con diferencias absolutas y porcentuales
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 diferencias:
 *                   peso_kg:
 *                     absoluta: -4.5
 *                     porcentual: -5.3
 *                   imc:
 *                     absoluta: -1.47
 *                     porcentual: -5.3
 *                   porcentaje_grasa:
 *                     absoluta: -3.2
 *                     porcentual: -11.3
 *                 periodo_dias: 60
 */
clinicalEvaluationsRouter.get(
  '/patient/:id/compare',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  clinicalEvaluationsController.compare,
);

/**
 * @swagger
 * /clinical-evaluations/patient/{id}/trends:
 *   get:
 *     summary: Tendencias clínicas para gráficos
 *     description: |
 *       Devuelve series temporales de los indicadores clínicos del paciente.
 *       Preparado para alimentar gráficos en la plataforma web.
 *     tags: [Clinical Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *     responses:
 *       200:
 *         description: Series temporales de indicadores clínicos
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total_evaluaciones: 3
 *                 resumen:
 *                   peso_inicial: 88.0
 *                   peso_actual: 83.5
 *                   variacion_peso: -4.5
 *                 series:
 *                   peso:
 *                     - fecha: "2026-02-01"
 *                       valor: 88.0
 *                     - fecha: "2026-03-01"
 *                       valor: 85.5
 *                     - fecha: "2026-04-01"
 *                       valor: 83.5
 */
clinicalEvaluationsRouter.get(
  '/patient/:id/trends',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  clinicalEvaluationsController.getTrends,
);

/**
 * @swagger
 * /clinical-evaluations/{id}:
 *   get:
 *     summary: Detalle de una evaluación
 *     description: Obtiene todos los campos de una evaluación específica.
 *     tags: [Clinical Evaluations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_evaluacion
 *     responses:
 *       200:
 *         description: Detalle completo de la evaluación
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
clinicalEvaluationsRouter.get(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  clinicalEvaluationsController.getById,
);