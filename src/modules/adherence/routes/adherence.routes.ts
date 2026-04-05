import { Router }               from 'express';
import { adherenceController }  from '../controller/adherence.controller';
import { authenticate }         from '@middlewares/authenticate';
import { requireRole }          from '@middlewares/authorize';

export const adherenceRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Adherence
 *   description: Índice de adherencia semanal al plan nutricional
 */

/**
 * @swagger
 * /adherence/me/current-week:
 *   get:
 *     summary: Adherencia de la semana actual (paciente)
 *     description: |
 *       Calcula en tiempo real el porcentaje de cumplimiento alimenticio y físico
 *       de la semana en curso. Incluye el detalle de comidas y ejercicios.
 *     tags: [Adherence]
 *     responses:
 *       200:
 *         description: Adherencia calculada con detalle
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 tiene_semana_activa: true
 *                 semana:
 *                   numero: 3
 *                   fecha_inicio_semana: "2026-04-07"
 *                   fecha_fin_semana: "2026-04-11"
 *                 adherencia:
 *                   pct_cumplimiento_alimenticio: 74
 *                   pct_cumplimiento_ejercicio: 60
 *                   nivel: medio
 *                   detalle:
 *                     alimenticio:
 *                       realizadas: 18
 *                       total: 25
 *                       pct: 72
 *                     ejercicio:
 *                       completados: 6
 *                       total: 10
 *                       pct: 60
 */
adherenceRouter.get('/me/current-week',  authenticate, requireRole('paciente'),      adherenceController.getMyCurrentWeek);
adherenceRouter.get('/me/history',       authenticate, requireRole('paciente'),      adherenceController.getMyHistory);
adherenceRouter.get('/patient/:id',      authenticate, requireRole('nutricionista'), adherenceController.getCurrentWeek);
adherenceRouter.get('/patient/:id/history', authenticate, requireRole('nutricionista'), adherenceController.getHistory);