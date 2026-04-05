import { Request, Response, NextFunction } from 'express';
import { adherenceService } from '../service/adherence.service';
import { ok }               from '@utils/response';

export const adherenceController = {

  async getCurrentWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const result   = await adherenceService.calculateCurrentWeek(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getMyCurrentWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adherenceService.calculateCurrentWeek(req.user!.id_perfil!);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const page     = parseInt(String(req.query.page), 10) || 1;
      const limit    = parseInt(String(req.query.limit), 10) || 10;
      const result   = await adherenceService.getHistory(perfilId, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page   = parseInt(String(req.query.page), 10) || 1;
      const limit  = parseInt(String(req.query.limit), 10) || 10;
      const result = await adherenceService.getHistory(req.user!.id_perfil!, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

};