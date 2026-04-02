import { Request, Response, NextFunction } from 'express';
import { dishesService }   from '../service/dishes.service';
import { ok, created, noContent } from '@utils/response';
import { CreateDishDto, UpdateDishDto, UpsertIngredientDto } from '../dto/dishes.dto';

export const dishesController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q      = req.query;
      const result = await dishesService.list({
        search: q.search as string | undefined,
        activo: q.activo as string | undefined,
        page:   parseInt(String(q.page), 10) || 1,
        limit:  parseInt(String(q.limit), 10) || 20,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dishesService.getById(parseInt(String(req.params.id), 10));
      ok(res, result);
    } catch (error) { next(error); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dishesService.create(req.body as CreateDishDto);
      created(res, result, 'Plato creado exitosamente');
    } catch (error) { next(error); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dishesService.update(parseInt(String(req.params.id), 10), req.body as UpdateDishDto);
      ok(res, result, 'Plato actualizado');
    } catch (error) { next(error); }
  },

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activo = req.body.activo === true || req.body.activo === 'true';
      const result = await dishesService.setStatus(parseInt(String(req.params.id), 10), activo);
      ok(res, result, activo ? 'Plato activado' : 'Plato desactivado');
    } catch (error) { next(error); }
  },

  async upsertIngredient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await dishesService.upsertIngredient(
        parseInt(String(req.params.id), 10),
        req.body as UpsertIngredientDto,
      );
      ok(res, result, 'Ingrediente actualizado. Calorías recalculadas.');
    } catch (error) { next(error); }
  },

  async removeIngredient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await dishesService.removeIngredient(
        parseInt(String(req.params.id), 10),
        parseInt(String(req.params.ingId), 10),
      );
      noContent(res);
    } catch (error) { next(error); }
  },

};