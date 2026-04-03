import { Router }                  from 'express';
import { mealTrackingController }  from '../controller/meal-tracking.controller';
import { authenticate }            from '@middlewares/authenticate';
import { requireRole }             from '@middlewares/authorize';
import { validate }                from '@middlewares/validate';
import { TrackMealDto }            from '../dto/meal-tracking.dto';

export const mealTrackingRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Meal Tracking
 *   description: Seguimiento diario de comidas — app móvil
 */

/**
 * @swagger
 * /meal-tracking/today:
 *   get:
 *     summary: Comidas del día con estado de cumplimiento
 *     description: |
 *       Retorna todos los menús del día actual con su estado: pendiente, realizado o no_realizado.
 *       También incluye el resumen de cumplimiento del día.
 *     tags: [Meal Tracking]
 *     responses:
 *       200:
 *         description: Comidas del día con resumen
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 tiene_menus_hoy: true
 *                 fecha: "2026-04-07"
 *                 menus:
 *                   - id_menu_diario: 1
 *                     nombre_tiempo: Desayuno
 *                     hora_inicio: "06:00:00"
 *                     nombre_plato: Avena con frutas
 *                     calorias_aportadas: 520
 *                     estado: pendiente
 *                     puede_registrar: true
 *                 resumen:
 *                   total: 5
 *                   realizadas: 2
 *                   pendientes: 3
 *                   pct_cumplimiento: 40
 */
mealTrackingRouter.get(
  '/today',
  authenticate,
  requireRole('paciente'),
  mealTrackingController.getToday,
);

/**
 * @swagger
 * /meal-tracking:
 *   post:
 *     summary: Marcar comida como realizada o no realizada
 *     description: |
 *       El paciente marca una comida del día como realizada o saltada.
 *
 *       **Regla RN-03:** El backend valida que la fecha del menú sea la fecha actual.
 *       Si el menú corresponde a otro día, rechaza con 422.
 *
 *       **Efecto automático:** Al marcar como realizada, las calorías se suman al balance calórico.
 *       Al desmarcar, las calorías se restan.
 *     tags: [Meal Tracking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             id_menu_diario: 1
 *             realizado: true
 *             hora_registro: "07:30"
 *     responses:
 *       200:
 *         description: Seguimiento guardado con balance calórico actualizado
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 seguimiento:
 *                   id_seguimiento_comida: 3
 *                   realizado: true
 *                   hora_registro: "07:30"
 *                 control_calorico:
 *                   calorias_objetivo: 2190
 *                   calorias_consumidas_plan: 520
 *                   calorias_restantes: 1670
 *                   en_deficit: true
 *               message: Comida marcada como realizada
 *       422:
 *         description: Solo puedes registrar cumplimiento en el día actual (RN-03)
 *       403:
 *         description: Este menú no pertenece a tu plan
 */
mealTrackingRouter.post(
  '/',
  authenticate,
  requireRole('paciente'),
  validate(TrackMealDto),
  mealTrackingController.trackMeal,
);

/**
 * @swagger
 * /meal-tracking/patient/{id}:
 *   get:
 *     summary: Historial de comidas de un paciente
 *     description: La nutricionista consulta el cumplimiento alimentario de un paciente por fecha.
 *     tags: [Meal Tracking]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *       - in: query
 *         name: fecha
 *         schema: { type: string }
 *         example: "2026-04-07"
 *         description: Fecha a consultar (YYYY-MM-DD). Default hoy.
 *     responses:
 *       200:
 *         description: Seguimiento de comidas de la fecha indicada
 */
mealTrackingRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  mealTrackingController.getPatientHistory,
);