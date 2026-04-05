import { Router }                   from 'express';
import { appointmentsController }   from '../controller/appointments.controller';
import { authenticate }             from '@middlewares/authenticate';
import { requireRole }              from '@middlewares/authorize';
import { validate }                 from '@middlewares/validate';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ChangeStatusDto,
  LinkEvaluationDto,
} from '../dto/appointments.dto';

export const appointmentsRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Gestión de citas nutricionales
 */

// ── App móvil — el paciente ve sus citas ──────────────────────────────────────

/**
 * @swagger
 * /appointments/me:
 *   get:
 *     summary: Mis próximas citas (paciente - app móvil)
 *     description: |
 *       El paciente consulta sus citas desde la app móvil.
 *       Por defecto muestra solo las citas programadas y futuras.
 *       Usa `?proximas=false` para ver el historial completo.
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: proximas
 *         schema: { type: string, enum: [true, false] }
 *         description: "true = solo próximas (default), false = historial completo"
 *     responses:
 *       200:
 *         description: Lista de citas del paciente
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_cita: 3
 *                   fecha_hora: "2026-04-15T10:00:00Z"
 *                   estado: programada
 *                   nombre_nutricionista: "Dra. García"
 *                   notas: "Traer resultados de análisis"
 */
appointmentsRouter.get(
  '/me',
  authenticate,
  requireRole('paciente'),
  appointmentsController.getMyAppointments,
);

// ── Plataforma web — la nutricionista gestiona las citas ──────────────────────

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Programar nueva cita
 *     description: |
 *       La nutricionista programa una cita para un paciente.
 *       La cita se crea en estado **programada**.
 *
 *       **Validación de conflictos:** El sistema verifica que no exista otra cita
 *       programada en un rango de ±30 minutos del mismo horario.
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_perfil, fecha_hora]
 *             properties:
 *               id_perfil:
 *                 type: integer
 *                 example: 1
 *               fecha_hora:
 *                 type: string
 *                 example: "2026-04-15T10:00:00"
 *                 description: Formato ISO 8601. Debe ser una fecha futura.
 *               notas:
 *                 type: string
 *                 example: "Primera consulta de seguimiento mensual"
 *     responses:
 *       201:
 *         description: Cita programada
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id_cita: 3
 *                 id_perfil: 1
 *                 fecha_hora: "2026-04-15T10:00:00Z"
 *                 estado: programada
 *               message: Cita programada exitosamente
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       422:
 *         description: Conflicto de horario con otra cita
 */
appointmentsRouter.post(
  '/',
  authenticate,
  requireRole('nutricionista'),
  validate(CreateAppointmentDto),
  appointmentsController.create,
);

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: Listar citas con filtros
 *     description: Lista todas las citas de la nutricionista con filtros opcionales.
 *     tags: [Appointments]
 *     parameters:
 *       - in: query
 *         name: id_perfil
 *         schema: { type: integer }
 *         description: Filtrar por paciente (id_perfil)
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [programada, atendida, cancelada, reprogramada] }
 *       - in: query
 *         name: desde
 *         schema: { type: string }
 *         example: "2026-04-01"
 *       - in: query
 *         name: hasta
 *         schema: { type: string }
 *         example: "2026-04-30"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista de citas paginada
 */
appointmentsRouter.get(
  '/',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  appointmentsController.list,
);

/**
 * @swagger
 * /appointments/patient/{id}:
 *   get:
 *     summary: Historial de citas de un paciente con estadísticas
 *     description: |
 *       Muestra el historial completo de citas de un paciente y su porcentaje de asistencia.
 *       Útil para evaluar el compromiso del paciente con el programa.
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *     responses:
 *       200:
 *         description: Historial con estadísticas de cumplimiento
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 estadisticas:
 *                   total: 8
 *                   atendidas: 6
 *                   canceladas: 1
 *                   reprogramadas: 1
 *                   pct_asistencia: 86
 *                   clasificacion: bueno
 *                   mensaje: "El paciente tiene un excelente historial de asistencia."
 *                 historial:
 *                   - id_cita: 1
 *                     fecha_hora: "2026-03-01T10:00:00Z"
 *                     estado: atendida
 */
appointmentsRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  appointmentsController.getPatientHistory,
);

/**
 * @swagger
 * /appointments/{id}:
 *   get:
 *     summary: Detalle de una cita
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalle completo con datos del paciente y evaluación vinculada
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
appointmentsRouter.get(
  '/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  appointmentsController.getById,
);

/**
 * @swagger
 * /appointments/{id}:
 *   put:
 *     summary: Actualizar fecha/hora y notas de una cita
 *     description: |
 *       Solo se pueden editar citas en estado **programada** o **reprogramada**.
 *       Verifica conflicto de horario si se cambia la fecha.
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             fecha_hora: "2026-04-16T11:00:00"
 *             notas: "Se reprogramó por solicitud del paciente"
 *     responses:
 *       200:
 *         description: Cita actualizada
 *       422:
 *         description: No se puede editar — estado incorrecto o conflicto de horario
 */
appointmentsRouter.put(
  '/:id',
  authenticate,
  requireRole('nutricionista'),
  validate(UpdateAppointmentDto),
  appointmentsController.update,
);

/**
 * @swagger
 * /appointments/{id}/status:
 *   patch:
 *     summary: Cambiar estado de la cita
 *     description: |
 *       Cambia el estado de la cita respetando las transiciones válidas:
 *
 *       | Desde | Puede pasar a |
 *       |---|---|
 *       | programada | atendida, cancelada, reprogramada |
 *       | reprogramada | programada, cancelada, atendida |
 *       | atendida | (estado final — no cambia) |
 *       | cancelada | (estado final — no cambia) |
 *     tags: [Appointments]
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
 *             estado: atendida
 *             notas: "Consulta realizada. Se actualizó el plan."
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       422:
 *         description: Transición de estado no válida
 */
appointmentsRouter.patch(
  '/:id/status',
  authenticate,
  requireRole('nutricionista'),
  validate(ChangeStatusDto),
  appointmentsController.changeStatus,
);

/**
 * @swagger
 * /appointments/{id}/link-evaluation:
 *   patch:
 *     summary: Vincular evaluación clínica a la cita
 *     description: |
 *       Asocia una evaluación clínica registrada durante la cita.
 *       La evaluación debe pertenecer al mismo paciente que la cita.
 *       Útil para tener trazabilidad de qué evaluación se hizo en qué consulta.
 *     tags: [Appointments]
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
 *             id_evaluacion: 3
 *     responses:
 *       200:
 *         description: Evaluación vinculada exitosamente
 *       422:
 *         description: La evaluación no pertenece al mismo paciente que la cita
 */
appointmentsRouter.patch(
  '/:id/link-evaluation',
  authenticate,
  requireRole('nutricionista'),
  validate(LinkEvaluationDto),
  appointmentsController.linkEvaluation,
);

/**
 * @swagger
 * /appointments/{id}:
 *   delete:
 *     summary: Eliminar cita
 *     description: |
 *       Elimina una cita de la base de datos.
 *       **Solo se puede eliminar si está en estado programada.**
 *       Para citas ya atendidas o canceladas, no es posible eliminarlas
 *       porque forman parte del historial del paciente.
 *     tags: [Appointments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Cita eliminada
 *       422:
 *         description: No se puede eliminar — estado incorrecto
 */
appointmentsRouter.delete(
  '/:id',
  authenticate,
  requireRole('nutricionista'),
  appointmentsController.delete,
);