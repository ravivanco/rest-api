import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../service/dashboard.service';
import { ok }               from '@utils/response';

export const dashboardController = {

  async getNutritionistDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dashboardService.getNutritionistDashboard(req.user!.id);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const result   = await dashboardService.getPatientDashboard(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getMyProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = req.query.period as string ?? '30d';
      const result = await dashboardService.getPatientProgress(req.user!.id_perfil!, period);
      ok(res, result);
    } catch (error) { next(error); }
  },

};