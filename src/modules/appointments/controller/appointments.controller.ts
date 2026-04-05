import { Request, Response, NextFunction } from 'express';
import { appointmentsService }             from '../service/appointments.service';
import { ok, created, noContent }          from '@utils/response';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ChangeStatusDto,
  LinkEvaluationDto,
} from '../dto/appointments.dto';

export const appointmentsController = {

  /**
   * POST /api/appointments
   * La nutricionista crea una nueva cita.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateAppointmentDto;
      const cita = await appointmentsService.createAppointment(req.user!.id, data);
      created(res, cita, 'Cita programada exitosamente');
    } catch (error) { next(error); }
  },


  /**
   * GET /api/appointments
   * Lista las citas de la nutricionista con filtros.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q      = req.query;
      const result = await appointmentsService.listAppointments(req.user!.id, {
        id_perfil: q.id_perfil ? parseInt(q.id_perfil as string) : undefined,
        estado:    q.estado    as string | undefined,
        desde:     q.desde     as string | undefined,
        hasta:     q.hasta     as string | undefined,
        page:      parseInt(q.page  as string) || 1,
        limit:     parseInt(q.limit as string) || 20,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },


  /**
   * GET /api/appointments/:id
   * Detalle de una cita.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cita = await appointmentsService.getById(
        parseInt(String(req.params.id), 10), req.user!.id
      );
      ok(res, cita);
    } catch (error) { next(error); }
  },


  /**
   * PUT /api/appointments/:id
   * Actualiza fecha/hora y notas de una cita.
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as UpdateAppointmentDto;
      const cita = await appointmentsService.updateAppointment(
        parseInt(String(req.params.id), 10), req.user!.id, data
      );
      ok(res, cita, 'Cita actualizada');
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/appointments/:id/status
   * Cambia el estado de una cita.
   */
  async changeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as ChangeStatusDto;
      const cita = await appointmentsService.changeStatus(
        parseInt(String(req.params.id), 10), req.user!.id, data
      );
      ok(res, cita, `Cita marcada como ${data.estado}`);
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/appointments/:id/link-evaluation
   * Vincula una evaluación clínica a la cita.
   */
  async linkEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as LinkEvaluationDto;
      const cita = await appointmentsService.linkEvaluation(
        parseInt(String(req.params.id), 10), req.user!.id, data
      );
      ok(res, cita, 'Evaluación vinculada a la cita exitosamente');
    } catch (error) { next(error); }
  },


  /**
   * DELETE /api/appointments/:id
   * Elimina una cita programada.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await appointmentsService.deleteAppointment(
        parseInt(String(req.params.id), 10), req.user!.id
      );
      noContent(res);
    } catch (error) { next(error); }
  },


  /**
   * GET /api/appointments/patient/:id
   * Historial de citas de un paciente con estadísticas.
   */
  async getPatientHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const result   = await appointmentsService.getComplianceHistory(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },


  /**
   * GET /api/appointments/me
   * El paciente ve sus próximas citas desde la app móvil.
   */
  async getMyAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const soloProximas = req.query.proximas !== 'false';
      const result       = await appointmentsService.getMyAppointments(
        req.user!.id_perfil!,
        soloProximas,
      );
      ok(res, result);
    } catch (error) { next(error); }
  },

};