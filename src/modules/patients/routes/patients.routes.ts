import { Router }             from 'express';
import { patientsController } from '../controller/patients.controller';
import { authenticate }       from '@middlewares/authenticate';
import { requireRole }        from '@middlewares/authorize';

export const patientsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Gestión de pacientes — plataforma web y app móvil
 */

/**
 * @swagger
 * /patients:
 *   get:
 *     summary: Listar todos los pacientes
 *     description: Retorna la lista de pacientes con filtros opcionales. Solo nutricionista.
 *     tags: [Patients]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por nombre o correo
 *       - in: query
 *         name: estado_plan
 *         schema: { type: string, enum: [pendiente, activo, suspendido, finalizado] }
 *       - in: query
 *         name: adherencia
 *         schema: { type: string, enum: [alto, medio, bajo] }
 *       - in: query
 *         name: formulario_completado
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de pacientes paginada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
patientsRouter.get(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  patientsController.list,
);

/**
 * @swagger
 * /patients/me:
 *   get:
 *     summary: Datos del paciente autenticado
 *     description: El paciente ve su propio resumen desde la app móvil.
 *     tags: [Patients]
 *     responses:
 *       200:
 *         description: Datos del paciente autenticado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
patientsRouter.get(
  '/me',
  authenticate,
  requireRole('paciente'),
  patientsController.me,
);

/**
 * @swagger
 * /patients/{id}:
 *   get:
 *     summary: Ficha completa de un paciente
 *     description: La nutricionista ve la ficha completa de un paciente específico.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID del usuario (id_usuario)
 *     responses:
 *       200:
 *         description: Ficha completa del paciente
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
patientsRouter.get(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  patientsController.getById,
);