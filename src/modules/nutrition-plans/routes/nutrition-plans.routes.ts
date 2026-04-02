import { Router }                      from 'express';
import { nutritionPlansController }    from '../controller/nutrition-plans.controller';
import { authenticate }                from '@middlewares/authenticate';
import { requireRole }                 from '@middlewares/authorize';
import { validate }                    from '@middlewares/validate';
import {
  CreatePlanDto,
  ActivatePlanDto,
  CreateWeekDto,
  CreateMenuDto,
  CreateDailyExerciseDto,
} from '../dto/nutrition-plans.dto';

export const nutritionPlansRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Nutrition Plans
 *   description: Gestión del plan nutricional — activación, suspensión y estructura semanal
 */

// ── Plan maestro ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /nutrition-plans/me/active:
 *   get:
 *     summary: Plan activo del paciente (app móvil)
 *     description: |
 *       El paciente consulta su plan activo completo desde la app móvil.
 *       Incluye semanas, días, menús y ejercicios.
 *
 *       **Regla RN-02:** Solo retorna datos si el plan está activo
 *       y `modulo_habilitado = true`.
 *
 *       **Regla RN-03:** Cada día incluye el campo `puede_registrar = true`
 *       solo si ese día es la fecha actual del servidor.
 *     tags: [Nutrition Plans]
 *     responses:
 *       200:
 *         description: Plan activo con estructura completa
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 tiene_plan_activo: true
 *                 plan:
 *                   id_plan: 3
 *                   estado: activo
 *                   modulo_habilitado: true
 *                   fecha_inicio: "2026-04-01"
 *                 semana_actual:
 *                   id_semana: 2
 *                   numero: 2
 *                 semanas:
 *                   - semana: { id_semana: 2, numero: 2 }
 *                     es_semana_actual: true
 *                     dias:
 *                       - dia: { dia_semana: lunes, fecha: "2026-04-07", es_hoy: true, puede_registrar: true }
 *                         menus:
 *                           - nombre_tiempo: Desayuno
 *                             nombre_plato: Avena con frutas
 *                             calorias_aportadas: 520
 *                         ejercicios:
 *                           - nombre_ejercicio: Caminata rápida
 *                             duracion_min: 30
 */
nutritionPlansRouter.get(
  '/me/active',
  authenticate,
  requireRole('paciente'),
  nutritionPlansController.getActivePlan,
);

/**
 * @swagger
 * /nutrition-plans/patient/{perfilId}:
 *   post:
 *     summary: Crear plan nutricional para un paciente
 *     description: |
 *       La nutricionista crea un plan para el paciente.
 *       El plan inicia en estado **pendiente** con `modulo_habilitado = false`.
 *       Se debe vincular a una evaluación clínica existente del paciente.
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: perfilId
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             id_evaluacion: 1
 *             notas: "Plan enfocado en reducción de grasa corporal"
 *     responses:
 *       201:
 *         description: Plan creado en estado pendiente
 *       404:
 *         description: Paciente o evaluación no encontrada
 *       422:
 *         description: La evaluación no corresponde al paciente
 */
nutritionPlansRouter.post(
  '/patient/:perfilId',
  authenticate,
  requireRole('nutricionista'),
  validate(CreatePlanDto),
  nutritionPlansController.create,
);

/**
 * @swagger
 * /nutrition-plans/patient/{perfilId}:
 *   get:
 *     summary: Historial de planes de un paciente
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: perfilId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de planes del paciente
 */
nutritionPlansRouter.get(
  '/patient/:perfilId',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  nutritionPlansController.getPatientPlans,
);

/**
 * @swagger
 * /nutrition-plans/{id}/activate:
 *   patch:
 *     summary: Activar plan con fecha de inicio
 *     description: |
 *       Activa el plan. Solo funciona si el plan está en estado **pendiente**.
 *
 *       **Efecto:**
 *       - `estado` → activo
 *       - `modulo_habilitado` → true (el paciente ya puede ver su plan en la app)
 *     tags: [Nutrition Plans]
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
 *             fecha_inicio: "2026-04-01"
 *             fecha_fin: "2026-06-30"
 *     responses:
 *       200:
 *         description: Plan activado
 *       422:
 *         description: El plan no está en estado pendiente
 */
nutritionPlansRouter.patch(
  '/:id/activate',
  authenticate,
  requireRole('nutricionista'),
  validate(ActivatePlanDto),
  nutritionPlansController.activate,
);

/**
 * @swagger
 * /nutrition-plans/{id}/suspend:
 *   patch:
 *     summary: Suspender plan activo
 *     description: Suspende el plan. El paciente ya no verá su plan en la app.
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plan suspendido
 */
nutritionPlansRouter.patch(
  '/:id/suspend',
  authenticate,
  requireRole('nutricionista'),
  nutritionPlansController.suspend,
);

/**
 * @swagger
 * /nutrition-plans/{id}/reactivate:
 *   patch:
 *     summary: Reactivar plan suspendido
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plan reactivado
 */
nutritionPlansRouter.patch(
  '/:id/reactivate',
  authenticate,
  requireRole('nutricionista'),
  nutritionPlansController.reactivate,
);

/**
 * @swagger
 * /nutrition-plans/{id}/lock-module:
 *   patch:
 *     summary: Bloquear módulo Mi Plan
 *     description: El paciente ya no puede ver su plan aunque el plan esté activo.
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Módulo bloqueado
 */
nutritionPlansRouter.patch(
  '/:id/lock-module',
  authenticate,
  requireRole('nutricionista'),
  nutritionPlansController.lockModule,
);

/**
 * @swagger
 * /nutrition-plans/{id}/unlock-module:
 *   patch:
 *     summary: Desbloquear módulo Mi Plan
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Módulo desbloqueado
 */
nutritionPlansRouter.patch(
  '/:id/unlock-module',
  authenticate,
  requireRole('nutricionista'),
  nutritionPlansController.unlockModule,
);

nutritionPlansRouter.get(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  nutritionPlansController.getById,
);

// ── Semanas ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /nutrition-plans/{planId}/weeks:
 *   post:
 *     summary: Crear semana dentro del plan
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             numero: 1
 *             fecha_inicio_semana: "2026-04-07"
 *             fecha_fin_semana: "2026-04-11"
 *     responses:
 *       201:
 *         description: Semana creada
 */
nutritionPlansRouter.post(
  '/:planId/weeks',
  authenticate,
  requireRole('nutricionista'),
  validate(CreateWeekDto),
  nutritionPlansController.createWeek,
);

nutritionPlansRouter.get(
  '/:planId/weeks',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  nutritionPlansController.getWeeks,
);

// ── Menús y ejercicios por día ─────────────────────────────────────────────────

/**
 * @swagger
 * /nutrition-plans/weeks/{weekId}/days/{day}/menus:
 *   post:
 *     summary: Asignar menú a un día y tiempo de comida
 *     description: |
 *       Asigna un plato a un tiempo de comida en un día específico de la semana.
 *       El día se especifica como texto: `lunes`, `martes`, `miercoles`, `jueves`, `viernes`.
 *       El parámetro `fecha` en query es la fecha real del día (YYYY-MM-DD).
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: weekId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: day
 *         required: true
 *         schema: { type: string }
 *         example: lunes
 *       - in: query
 *         name: fecha
 *         required: true
 *         schema: { type: string }
 *         example: "2026-04-07"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             id_tiempo_comida: 1
 *             id_plato: 5
 *             calorias_aportadas: 520
 *     responses:
 *       201:
 *         description: Menú asignado
 */
nutritionPlansRouter.post(
  '/weeks/:weekId/days/:day/menus',
  authenticate,
  requireRole('nutricionista'),
  validate(CreateMenuDto),
  nutritionPlansController.createMenu,
);

/**
 * @swagger
 * /nutrition-plans/weeks/{weekId}/days/{day}/exercises:
 *   post:
 *     summary: Asignar ejercicio a un día del plan
 *     tags: [Nutrition Plans]
 *     parameters:
 *       - in: path
 *         name: weekId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: day
 *         required: true
 *         schema: { type: string }
 *         example: lunes
 *       - in: query
 *         name: fecha
 *         schema: { type: string }
 *         example: "2026-04-07"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             id_ejercicio: 3
 *     responses:
 *       201:
 *         description: Ejercicio asignado al día
 */
nutritionPlansRouter.post(
  '/weeks/:weekId/days/:day/exercises',
  authenticate,
  requireRole('nutricionista'),
  validate(CreateDailyExerciseDto),
  nutritionPlansController.createDailyExercise,
);

nutritionPlansRouter.delete(
  '/weeks/:weekId/days/:day/exercises/:exId',
  authenticate,
  requireRole('nutricionista'),
  nutritionPlansController.removeDailyExercise,
);