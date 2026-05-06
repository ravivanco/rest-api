import { Router } from 'express';
import { tiemposComidaController } from '../controller/tiempos-comida.controller';

export const tiemposComidaRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Tiempos Comida
 *   description: Catalogo de tiempos de comida
 */

/**
 * @swagger
 * /tiempos-comida:
 *   get:
 *     summary: Listar tiempos de comida activos
 *     tags: [Tiempos Comida]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de tiempos de comida
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_tiempo_comida: { type: integer, example: 1 }
 *                   nombre: { type: string, example: Desayuno }
 *                   hora_inicio: { type: string, example: '06:00' }
 *                   hora_fin: { type: string, example: '09:00' }
 *                   orden: { type: integer, example: 1 }
 */
tiemposComidaRouter.get('/', tiemposComidaController.list);
