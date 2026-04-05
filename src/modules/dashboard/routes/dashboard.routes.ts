import { Router }               from 'express';
import { dashboardController }  from '../controller/dashboard.controller';
import { authenticate }         from '@middlewares/authenticate';
import { requireRole }          from '@middlewares/authorize';

export const dashboardRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboards consolidados para nutricionista y paciente
 */

/**
 * @swagger
 * /dashboard/nutritionist:
 *   get:
 *     summary: Dashboard principal de la nutricionista
 *     description: |
 *       Vista consolidada de todos los pacientes con métricas clave.
 *       Incluye conteos por estado de plan, adherencia y alertas pendientes.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard completo de la nutricionista
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 resumen:
 *                   total_pacientes: 45
 *                   planes_activos: 32
 *                   planes_pendientes: 8
 *                   planes_suspendidos: 2
 *                   formularios_pendientes: 5
 *                   alertas_sin_revisar: 7
 *                 pacientes_por_adherencia:
 *                   alto: 12
 *                   medio: 14
 *                   bajo: 6
 *                   sin_datos: 13
 */
dashboardRouter.get('/nutritionist',   authenticate, requireRole('nutricionista'), dashboardController.getNutritionistDashboard);

/**
 * @swagger
 * /dashboard/patient/{id}:
 *   get:
 *     summary: Dashboard completo de un paciente
 *     description: |
 *       Vista detallada de un paciente para la plataforma web.
 *       Incluye perfil, plan activo, última evaluación, peso, adherencia y balance calórico.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *     responses:
 *       200:
 *         description: Dashboard completo del paciente
 */
dashboardRouter.get('/patient/:id',    authenticate, requireRole('nutricionista'), dashboardController.getPatientDashboard);

/**
 * @swagger
 * /dashboard/me/progress:
 *   get:
 *     summary: Progreso propio del paciente (app móvil)
 *     description: |
 *       Series temporales de peso, calorías y adherencia para gráficos.
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [7d, 30d, 90d] }
 *         description: Período de consulta (default 30d)
 *     responses:
 *       200:
 *         description: Series de progreso listas para gráficos
 */
dashboardRouter.get('/me/progress',    authenticate, requireRole('paciente'),      dashboardController.getMyProgress);