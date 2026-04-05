import { Router }            from 'express';
import { alertsController }  from '../controller/alerts.controller';
import { authenticate }      from '@middlewares/authenticate';
import { requireRole }       from '@middlewares/authorize';

export const alertsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Alertas clínicas automáticas para la nutricionista
 */

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: Listar alertas de la nutricionista
 *     description: |
 *       Retorna las alertas generadas automáticamente por el sistema.
 *
 *       **Tipos de alerta:**
 *       - `adherencia` — El paciente tiene adherencia baja (<50%)
 *       - `peso` — Cambio significativo de peso detectado
 *       - `consumo_adicional` — Alto consumo fuera del plan
 *       - `inactividad` — Sin registro de cumplimiento por 3+ días
 *       - `exceso_calorico` — Consumo adicional supera 30% del objetivo diario
 *     tags: [Alerts]
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema: { type: string, enum: [adherencia,peso,consumo_adicional,inactividad,exceso_calorico] }
 *       - in: query
 *         name: revisada
 *         schema: { type: string, enum: [true, false] }
 *         description: Por defecto muestra todas. Usa `false` para solo las pendientes.
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de alertas con contador de sin revisar
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_alerta_sistema: 34
 *                   tipo: adherencia
 *                   mensaje: "Adherencia baja: alimenticio 38%, ejercicio 20%"
 *                   nombre_paciente: Juan Pérez
 *                   fecha_generacion: "2026-04-07T10:00:00Z"
 *                   revisada: false
 *               meta:
 *                 total: 12
 *                 sin_revisar: 5
 */
alertsRouter.get('/', authenticate, requireRole('nutricionista', 'administrador'), alertsController.list);

/**
 * @swagger
 * /alerts/{id}/review:
 *   patch:
 *     summary: Marcar alerta como revisada
 *     description: La nutricionista marca una alerta como atendida.
 *     tags: [Alerts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Alerta marcada como revisada con fecha de revisión
 */
alertsRouter.patch('/:id/review', authenticate, requireRole('nutricionista'), alertsController.markReviewed);
alertsRouter.get('/patient/:id',  authenticate, requireRole('nutricionista'), alertsController.getPatientAlerts);