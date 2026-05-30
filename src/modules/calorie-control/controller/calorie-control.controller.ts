import { Request, Response, NextFunction } from 'express';
import { calorieControlService } from '../service/calorie-control.service';
import { ok } from '@utils/response';
import { DashboardQuerySchema } from '../dto/dashboard.dto';
import { CalorieHistoryDto } from '../dto/calorie-control.dto';
import { ValidationError } from '@errors/AppError';

const parsePerfilId = (value: unknown): number => {
  const perfilId = parseInt(String(value), 10);

  if (!Number.isFinite(perfilId)) {
    throw new ValidationError('id de paciente inválido');
  }

  return perfilId;
};

export const calorieControlController = {

  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = DashboardQuerySchema.parse(req.query);
      // Si no viene fecha, se pasa undefined y el servicio usará la fecha actual de la BD
      const result = await calorieControlService.getDashboardData(
        req.user!.id_perfil!,
        query.date || undefined
      );
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await calorieControlService.getTodayBalance(req.user!.id_perfil!);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parsePerfilId(req.params.id);
      const result   = await calorieControlService.getTodayBalance(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = CalorieHistoryDto.parse(req.query);
      const perfilId = parsePerfilId(req.params.id);
      const result = await calorieControlService.getHistory(
        perfilId,
        query.desde,
        query.hasta,
        query.page,
        query.limit,
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = CalorieHistoryDto.parse(req.query);
      const result = await calorieControlService.getHistory(
        req.user!.id_perfil!,
        query.desde,
        query.hasta,
        query.page,
        query.limit,
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getWeeklyProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = req.params.id
        ? parsePerfilId(req.params.id)
        : req.user!.id_perfil!;
      const result = await calorieControlService.getWeeklyProgress(perfilId);
      ok(res, result);
    } catch (error) { next(error); }
  },

};