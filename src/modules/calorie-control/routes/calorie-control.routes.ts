import { Router }                     from 'express';
import { calorieControlController }   from '../controller/calorie-control.controller';
import { authenticate }               from '@middlewares/authenticate';
import { requireRole }                from '@middlewares/authorize';

export const calorieControlRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Calorie Control
 *   description: Balance calórico diario y progreso semanal
 */

/**
 * @swagger
 * /calorie-control/today:
 *   get:
 *     summary: Balance calórico del día actual (paciente)
 *     description: |
 *       Retorna el balance calórico completo de hoy.
 *       Las columnas `calorias_totales_consumidas` y `calorias_restantes`
 *       son **calculadas automáticamente por PostgreSQL** (columnas generadas).
 *
 *       **RN-05:** Si hay exceso calórico, incluye sugerencias de ejercicios compensatorios.
 *     tags: [Calorie Control]
 *     responses:
 *       200:
 *         description: Balance calórico del día con sugerencias si hay exceso
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 tiene_plan_activo: true
 *                 fecha: "2026-04-07"
 *                 balance:
 *                   calorias_objetivo: 2190
 *                   calorias_consumidas_plan: 870
 *                   calorias_consumidas_adicional: 0
 *                   calorias_totales_consumidas: 870
 *                   calorias_restantes: 1320
 *                   progreso_pct: 40
 *                   estado: deficit
 *                 ejercicios_compensatorios: null
 */
calorieControlRouter.get(
  '/today',
  authenticate,
  requireRole('paciente'),
  calorieControlController.getToday,
);

/**
 * @swagger
 * /calorie-control/me/history:
 *   get:
 *     summary: Historial de balance calórico del paciente
 *     description: Serie temporal del balance calórico diario para gráficos.
 *     tags: [Calorie Control]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Historial paginado de balance calórico
 */

calorieControlRouter.get(
  '/me/history',
  authenticate,
  requireRole('paciente'),
  calorieControlController.getMyHistory,
);

/**
 * @swagger
 * /calorie-control/me/weekly:
 *   get:
 *     summary: Balance calórico de los últimos 7 días
 *     tags: [Calorie Control]
 *     responses:
 *       200:
 *         description: Serie de 7 días para gráfico semanal
 */


calorieControlRouter.get(
  '/me/weekly',
  authenticate,
  requireRole('paciente'),
  calorieControlController.getWeeklyProgress,
);

/**
 * @swagger
 * /calorie-control/patient/{id}/today:
 *   get:
 *     summary: Balance calórico de hoy de un paciente (nutricionista)
 *     tags: [Calorie Control]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *     responses:
 *       200:
 *         description: Balance calórico actual del paciente
 */

calorieControlRouter.get(
  '/patient/:id/today',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  calorieControlController.getPatientToday,
);

calorieControlRouter.get(
  '/patient/:id/weekly',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  calorieControlController.getWeeklyProgress,
);