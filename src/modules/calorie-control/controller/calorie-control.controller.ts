import { Request, Response, NextFunction } from 'express';
import { calorieControlService } from '../service/calorie-control.service';
import { ok } from '@utils/response';

export const calorieControlController = {

  async getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await calorieControlService.getTodayBalance(req.user!.id_perfil!);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const result   = await calorieControlService.getTodayBalance(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { desde, hasta } = req.query;
      const page  = parseInt(String(req.query.page), 10) || 1;
      const limit = parseInt(String(req.query.limit), 10) || 30;
      const result = await calorieControlService.getHistory(
        req.user!.id_perfil!,
        desde as string, hasta as string, page, limit,
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getWeeklyProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = req.params.id
        ? parseInt(String(req.params.id), 10)
        : req.user!.id_perfil!;
      const result = await calorieControlService.getWeeklyProgress(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

};