import { Request, Response, NextFunction } from 'express';
import { alertsService } from '../service/alerts.service';
import { ok }            from '@utils/response';

export const alertsController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q      = req.query;
      const result = await alertsService.getAlerts(req.user!.id, {
        tipo:     q.tipo     as string | undefined,
        revisada: q.revisada as string | undefined,
        page:     parseInt(String(q.page), 10) || 1,
        limit:    parseInt(String(q.limit), 10) || 20,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async markReviewed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alertId = parseInt(String(req.params.id), 10);
      const result  = await alertsService.markReviewed(alertId, req.user!.id);
      ok(res, result, 'Alerta marcada como revisada');
    } catch (error) { next(error); }
  },

  async getPatientAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const result   = await alertsService.getPatientAlerts(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

};