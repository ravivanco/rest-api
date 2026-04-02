import { Request, Response, NextFunction } from 'express';
import { clinicalEvaluationsService }      from '../service/clinical-evaluations.service';
import { ok, created }                     from '@utils/response';
import { CreateEvaluationDto }             from '../dto/clinical-evaluations.dto';

export const clinicalEvaluationsController = {

  /**
   * POST /api/clinical-evaluations
   * La nutricionista registra una nueva evaluación.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data       = req.body as CreateEvaluationDto;
      const evaluation = await clinicalEvaluationsService.createEvaluation(
        req.user!.id,
        data,
      );
      created(res, evaluation, 'Evaluación clínica registrada exitosamente');
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/clinical-evaluations/patient/:id
   * Historial de evaluaciones de un paciente.
   */
  async getPatientHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const history  = await clinicalEvaluationsService.getPatientHistory(perfilId);
      ok(res, history);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/clinical-evaluations/me/history
   * El paciente ve su propio historial desde la app móvil.
   */
  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = req.user!.id_perfil!;
      const history  = await clinicalEvaluationsService.getPatientHistory(perfilId);
      ok(res, history);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/clinical-evaluations/:id
   * Detalle de una evaluación específica.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id         = parseInt(String(req.params.id), 10);
      const evaluation = await clinicalEvaluationsService.getById(id);
      ok(res, evaluation);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/clinical-evaluations/patient/:id/compare?evaluation_ids=3,7
   * Compara dos evaluaciones del paciente.
   */
  async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId     = parseInt(String(req.params.id), 10);
      const idsStr       = req.query.evaluation_ids as string;
      const ids          = idsStr?.split(',').map(id => parseInt(id.trim())) ?? [];
      const comparison   = await clinicalEvaluationsService.compareEvaluations(perfilId, ids);
      ok(res, comparison);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/clinical-evaluations/patient/:id/trends
   * Tendencias clínicas para gráficos de la web.
   */
  async getTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const trends   = await clinicalEvaluationsService.getTrends(perfilId);
      ok(res, trends);
    } catch (error) {
      next(error);
    }
  },

};