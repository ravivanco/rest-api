import { Request, Response, NextFunction } from 'express';
import { exercisesService }  from '../service/exercises.service';
import { ok, created }       from '@utils/response';
import { CreateExerciseDto, UpdateExerciseDto } from '../dto/exercises.dto';

export const exercisesController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q      = req.query;
      const result = await exercisesService.list({
        search:                     q.search    as string | undefined,
        intensidad:                 q.intensidad as string | undefined,
        nivel_actividad_recomendado: q.nivel_actividad_recomendado as string | undefined,
        categoria:                  q.categoria as string | undefined,
        activo:                     q.activo    as string | undefined,
        page:  parseInt(String(q.page), 10) || 1,
        limit: parseInt(String(q.limit), 10) || 20,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exercise = await exercisesService.getById(parseInt(String(req.params.id), 10));
      ok(res, exercise);
    } catch (error) { next(error); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exercise = await exercisesService.create(req.body as CreateExerciseDto);
      created(res, exercise, 'Ejercicio creado exitosamente');
    } catch (error) { next(error); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exercise = await exercisesService.update(parseInt(String(req.params.id), 10), req.body as UpdateExerciseDto);
      ok(res, exercise, 'Ejercicio actualizado');
    } catch (error) { next(error); }
  },

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activo   = req.body.activo === true || req.body.activo === 'true';
      const exercise = await exercisesService.setStatus(parseInt(String(req.params.id), 10), activo);
      ok(res, exercise, activo ? 'Ejercicio activado' : 'Ejercicio desactivado');
    } catch (error) { next(error); }
  },

};