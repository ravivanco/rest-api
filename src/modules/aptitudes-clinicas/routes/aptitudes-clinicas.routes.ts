import { Router } from 'express';
import { aptitudesClinicasController } from '../controller/aptitudes-clinicas.controller';

export const aptitudesClinicasRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Aptitudes Clinicas
 *   description: Catalogo de aptitudes clinicas
 */

/**
 * @swagger
 * /aptitudes-clinicas:
 *   get:
 *     summary: Listar aptitudes clinicas
 *     tags: [Aptitudes Clinicas]
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de aptitudes clinicas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_aptitud: { type: integer, example: 1 }
 *                   codigo: { type: string, example: general }
 *                   nombre: { type: string, example: Pacientes en general }
 */
aptitudesClinicasRouter.get('/', aptitudesClinicasController.list);
