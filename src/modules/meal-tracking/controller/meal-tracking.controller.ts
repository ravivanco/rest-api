import { Request, Response, NextFunction } from 'express';
import { mealTrackingService } from '../service/meal-tracking.service';
import { ok } from '@utils/response';
import { TrackMealDto } from '../dto/meal-tracking.dto';

export const mealTrackingController = {

  async trackMeal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await mealTrackingService.trackMeal(
        req.user!.id_perfil!,
        req.body as TrackMealDto,
      );
      ok(res, result, result.seguimiento.realizado
        ? 'Comida marcada como realizada'
        : 'Comida marcada como no realizada'
      );
    } catch (error) { next(error); }
  },

  async getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await mealTrackingService.getTodayMeals(req.user!.id_perfil!);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const fecha    = req.query.fecha as string ?? new Date().toISOString().split('T')[0];
      const result   = await mealTrackingService.getPatientMealHistory(perfilId, fecha);
      ok(res, result);
    } catch (error) { next(error); }
  },

};