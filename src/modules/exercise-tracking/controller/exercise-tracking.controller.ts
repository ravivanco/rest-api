import { Request, Response, NextFunction } from 'express';
import { exerciseTrackingService } from '../service/exercise-tracking.service';
import { ok } from '@utils/response';
import { TrackExerciseDto } from '../dto/exercise-tracking.dto';

export const exerciseTrackingController = {

  async trackExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await exerciseTrackingService.trackExercise(
        req.user!.id_perfil!,
        req.body as TrackExerciseDto,
      );
      ok(res, result, result.seguimiento.completado
        ? 'Ejercicio marcado como completado'
        : 'Ejercicio marcado como no completado'
      );
    } catch (error) { next(error); }
  },

  async getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await exerciseTrackingService.getTodayExercises(req.user!.id_perfil!);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const fecha    = req.query.fecha as string ?? new Date().toISOString().split('T')[0];
      const result   = await exerciseTrackingService.getPatientExerciseHistory(perfilId, fecha);
      ok(res, result);
    } catch (error) { next(error); }
  },

};